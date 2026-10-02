-- BuildUVS Deck Importer — a Tabletop Simulator object that loads decklists
-- straight from builduvs.com.
--
-- Browse with the buttons (Decklists or Majors → format/season → event → deck)
-- and click a deck to spawn it, or paste a deck's link into the box on the home
-- screen. Either way the deck comes from that deck's /tts.json endpoint
-- (netlify/edge-functions/deck-tts.js) and lands in front of the importer:
-- character face up, main deck and sideboard face down.
--
-- This is the source. scripts/gen-tts-importer.mjs packs it into the saved
-- object public/tts/builduvs-importer.json — edit here, then re-run that.

-- Only these hosts are fetched from. The importer spawns whatever the response
-- describes, so it must not be pointable at an arbitrary URL.
local HOSTS = { ["builduvs.com"] = true, ["www.builduvs.com"] = true }
local SITE = "https://builduvs.com"

-- How far in front of the importer the piles land, in world units. A deck
-- whose spot is taken goes a row further out, until one is clear.
local SPAWN_DISTANCE = 7.5
local ROW_GAP = 4.5        -- between rows of decks (a card is ~3 deep)
local MAX_ROWS = 8
local CARD_W, CARD_D = 2.5, 3.5  -- a pile's footprint, with a little margin

-- Layout, in the tile's local units: it spans -1..1 on x and z, and local -z is
-- the far edge (the top, read from the seat the importer faces). A button's
-- width and height are in thousandths of these units. The tile's backdrop
-- image is drawn to this layout: scripts/gen-tts-importer.mjs reads these
-- numbers from here, so change them only here and re-run it.
local ROWS = 9             -- list rows per page
local TOP = -0.66          -- z of the first row
local ROW_STEP = 0.16      -- z between rows
local ROW_H = 0.14
local ROW_LEFT = -0.925
local ROW_RIGHT = 0.925
local HEADER_Z = -0.86
local NAV_Z = 0.86
local Y = 0.15             -- just above the tile's surface
local FONT = 62
local CHAR_W = 0.042       -- about how wide a character is at FONT
local CHIP_PAD = 0.07      -- room around a chip's text
local GAP = 0.012          -- between the pieces of a row
local BAR_W = 0.035        -- the symbol color bar

local function hex(h)
  return { tonumber(h:sub(2, 3), 16) / 255, tonumber(h:sub(4, 5), 16) / 255, tonumber(h:sub(6, 7), 16) / 255 }
end

local WHITE = { 1, 1, 1 }
local CLEAR = { 0, 0, 0, 0 }
local TEXT = hex("#F2F4F8")
local MUTED = hex("#AEB6C8")
local INK = hex("#151925")   -- text on the light medal chips
local ROW_A = hex("#1F2433")
local ROW_B = hex("#242A3B")
local CHIP = hex("#2F3649")
local ACCENT = hex("#1976D2")

-- The same colors the site's share images use for each resource symbol.
local SYMBOL = {
  air = hex("#7FC6F2"), all = hex("#C9C9C9"), chaos = hex("#D63B8F"),
  death = hex("#8A52C9"), earth = hex("#5AA844"), evil = hex("#8A3FBF"),
  fire = hex("#E8622A"), good = hex("#F2C94C"), infinity = hex("#9AA4B2"),
  life = hex("#46C06A"), order = hex("#E6DFAE"), void = hex("#5566C4"),
  water = hex("#2F86E0"),
}

-- Rank chips: medals for the podium, blue for the rest of the top 8.
local function rankChip(rank)
  local color, ink = CHIP, TEXT
  if rank == 1 then color, ink = hex("#E2B53E"), INK
  elseif rank == 2 then color, ink = hex("#B9C2CC"), INK
  elseif rank <= 4 then color, ink = hex("#C8823F"), INK
  elseif rank <= 8 then color = hex("#2D5C9A") end
  local v = rank % 100
  local suffix = ({ "st", "nd", "rd" })[v % 10]
  if not suffix or (v >= 11 and v <= 13) then suffix = "th" end
  return { text = rank .. suffix, color = color, font_color = ink }
end

local function lighten(c, t)
  return { c[1] + (1 - c[1]) * t, c[2] + (1 - c[2]) * t, c[3] + (1 - c[3]) * t }
end

-- UTF-8 characters, so shortening never splits one.
local function chars(s)
  local out = {}
  for ch in s:gmatch("[%z\1-\127\194-\244][\128-\191]*") do out[#out + 1] = ch end
  return out
end

-- The text, shortened with "…" if it won't fit in `width` units.
local function fit(text, width)
  local cs = chars(text)
  local room = math.floor((width - CHIP_PAD) / CHAR_W)
  if #cs <= room then return text end
  return table.concat(cs, "", 1, math.max(room - 1, 1)):gsub("[%s,·—-]+$", "") .. "…"
end

local function chipWidth(text)
  return #chars(text) * CHAR_W + CHIP_PAD
end

local link = ""
local busy = false

-- The screen being shown, and the ones under it for Back. A screen is
-- { title, items, page } or the home screen. An item is
-- { label, tooltip, open, bar, left, right }: bar is an optional color down the
-- left edge, left and right optional chips { text, color, font_color }.
local stack = {}
local cache = {}

-- ── Feedback ────────────────────────────────────────────────────────────────

local function tell(color, message, tint)
  if color and Player[color] and Player[color].seated then
    broadcastToColor(message, color, tint or WHITE)
  else
    broadcastToAll(message, tint or WHITE)
  end
end

local function warn(color, message) tell(color, message, { 1, 0.6, 0.3 }) end
local function fail(color, message) tell(color, message, { 1, 0.4, 0.4 }) end

-- ── Fetching ────────────────────────────────────────────────────────────────

local render -- defined below

local function setBusy(state)
  busy = state
  render()
end

-- GET a builduvs.com JSON endpoint and hand the decoded table to `done`. One
-- request at a time; the header reads "Loading..." until it answers, whatever
-- the answer. Listings are cached, since browsing back and forth would
-- otherwise refetch them.
local function getJSON(url, color, useCache, done)
  if useCache and cache[url] then return done(cache[url]) end
  if busy then return end
  setBusy(true)
  WebRequest.get(url, function(req)
    setBusy(false)
    if req.is_error then
      return fail(color, "Couldn't reach builduvs.com: " .. tostring(req.error))
    end
    if req.response_code == 404 then
      return warn(color, "Nothing found at that link.")
    end
    if req.response_code ~= 200 then
      return fail(color, "builduvs.com answered " .. tostring(req.response_code) .. ". Try again shortly.")
    end
    local ok, data = pcall(JSON.decode, req.text)
    if not ok or type(data) ~= "table" then
      return fail(color, "builduvs.com sent something unexpected.")
    end
    if useCache then cache[url] = data end
    done(data)
  end)
end

-- ── Spawning a deck ─────────────────────────────────────────────────────────

-- The importer spawns only cards. A script riding along in the response would
-- run on every player's machine, so strip any, however the JSON was produced.
local function stripScripts(obj)
  obj.LuaScript, obj.LuaScriptState, obj.XmlUI = "", "", ""
  for _, child in ipairs(obj.ContainedObjects or {}) do stripScripts(child) end
end

-- Rows filled in the last few seconds. A just-spawned deck may not be solid
-- yet, so the physics check alone could hand its row to the next import.
local recentRows = {}

-- Whether anything a deck shouldn't land on sits in the box. The table,
-- locked playmats and the importer itself don't count; cards always do.
local function occupied(center, size, turn)
  local hits = Physics.cast({
    origin = center, direction = { 0, -1, 0 }, type = 3,
    size = size, orientation = { 0, turn, 0 }, max_distance = 0,
  })
  for _, hit in ipairs(hits) do
    local obj = hit.hit_object
    if obj and obj ~= self and obj.interactable ~= false
      and (obj.type == "Card" or obj.type == "Deck" or not obj.getLock()) then
      return true
    end
  end
  return false
end

-- The nearest row in front of the importer with room for every pile, or nil.
local function freeRow(objects, origin, turn)
  local minX, maxX = math.huge, -math.huge
  for _, obj in ipairs(objects) do
    local x = (obj.Transform or {}).posX or 0
    minX, maxX = math.min(minX, x), math.max(maxX, x)
  end
  local size = { maxX - minX + CARD_W, 3, CARD_D }
  local now = os.time()
  for row = 0, MAX_ROWS - 1 do
    local z = -(SPAWN_DISTANCE + row * ROW_GAP)
    local center = origin + Vector((minX + maxX) / 2, 1, z):rotateOver("y", turn)
    if not (recentRows[row] and now - recentRows[row] < 3) and not occupied(center, size, turn) then
      recentRows[row] = now
      return z
    end
  end
end

-- Returns the number of piles spawned, or nil when there was no room.
local function spawnDeck(data)
  local origin = self.getPosition()
  -- Upright for White is Y 180 (the same as the cards), so measure from there.
  local turn = self.getRotation().y - 180
  if #data.ObjectStates == 0 then return 0 end
  local z = freeRow(data.ObjectStates, origin, turn)
  if not z then return nil end
  local count = 0
  for _, obj in ipairs(data.ObjectStates) do
    stripScripts(obj)
    local t = obj.Transform or {}
    -- Keep the file's left-to-right layout (face, deck, sideboard), turned to
    -- match the importer so the piles face whoever it is facing.
    local offset = Vector(t.posX or 0, 1, z):rotateOver("y", turn)
    spawnObjectJSON({
      json = JSON.encode(obj),
      position = origin + offset,
      rotation = { t.rotX or 0, (t.rotY or 180) + turn, t.rotZ or 0 },
    })
    count = count + 1
  end
  return count
end

local function importFrom(url, color)
  getJSON(url, color, false, function(data)
    if type(data.ObjectStates) ~= "table" then
      return fail(color, "That link didn't return a deck.")
    end
    local spawned = spawnDeck(data)
    if not spawned then
      return warn(color, "No clear space in front of the importer. Move some decks (or the importer) and try again.")
    end
    if spawned == 0 then
      return warn(color, "That deck has no cards with images.")
    end
    -- The main deck is the first real pile; the face card is a lone card.
    local name = "deck"
    for _, obj in ipairs(data.ObjectStates) do
      if obj.Name == "Deck" then name = obj.Nickname break end
    end
    tell(color, "Imported " .. name, { 0.5, 1, 0.5 })
  end)
end

-- ── Pasted links ────────────────────────────────────────────────────────────

local function trim(s)
  return (s:gsub("^%s+", ""):gsub("%s+$", ""))
end

-- Turn whatever was pasted into the deck's tts.json URL, or nil plus a reason.
-- Accepts the deck page link (with or without https://, a query string or a
-- trailing slash), a bare "/lists/<event>/<rank>" path, or the tts.json link.
function ttsUrl(text)
  local s = trim(text or "")
  s = s:gsub("[?#].*$", ""):gsub("/+$", "")
  if s == "" then return nil, "Paste a deck link from builduvs.com first." end

  if not s:find("^https?://") then
    if s:find("^/?lists/") or s:find("^/?majors/") then
      s = SITE .. "/" .. s:gsub("^/", "")
    else
      s = "https://" .. s
    end
  end

  local host, path = s:match("^https?://([^/]+)(/.*)$")
  if not host or not HOSTS[host:lower()] then
    return nil, "That isn't a builduvs.com link."
  end

  path = path:gsub("/tts%.json$", "")
  local section, event, rank = path:match("^/(%a+)/([^/]+)/(%d+)$")
  if (section ~= "lists" and section ~= "majors") or not event then
    return nil, "That link isn't a single deck. Open a deck on builduvs.com and copy its address."
  end
  return "https://" .. host .. "/" .. section .. "/" .. event .. "/" .. rank .. "/tts.json"
end

function importDeck(color)
  local url, problem = ttsUrl(link)
  if not url then return warn(color, problem) end
  importFrom(url, color)
end

-- ── Screens ─────────────────────────────────────────────────────────────────

local function push(screen)
  table.insert(stack, screen)
  render()
end

local function deckScreen(section, event, color)
  getJSON(SITE .. "/" .. section .. "/" .. event .. "/tts.json", color, true, function(data)
    local items = {}
    -- A deck is { rank, label, deck name, symbol, character, record }; listings
    -- from before rows had pieces stop after the deck name.
    for _, d in ipairs(data.decks or {}) do
      local url = SITE .. "/" .. section .. "/" .. event .. "/" .. d[1] .. "/tts.json"
      local symbol = d[4] or ""
      local about = {}
      if d[3] ~= "" then table.insert(about, d[3]) end
      if SYMBOL[symbol] then table.insert(about, symbol:sub(1, 1):upper() .. symbol:sub(2)) end
      table.insert(about, "click to spawn")
      table.insert(items, {
        label = d[5] or d[2],
        tooltip = table.concat(about, " — "),
        open = function(c) importFrom(url, c) end,
        bar = d[5] and (SYMBOL[symbol] or CHIP) or nil,
        left = d[5] and rankChip(d[1]) or nil,
        right = (d[6] or "") ~= "" and { text = d[6] } or nil,
      })
    end
    push({ title = data.title, items = items, page = 1 })
  end)
end

local function count(n, noun)
  return n .. " " .. noun .. (n == 1 and "" or "s")
end

local function eventItems(section, events)
  local items = {}
  for _, ev in ipairs(events) do
    table.insert(items, {
      label = ev.place or ev.label,
      open = function(c) deckScreen(section, ev.id, c) end,
      left = ev.date and { text = ev.date } or nil,
      right = ev.decks and { text = count(ev.decks, "deck") } or nil,
    })
  end
  return items
end

local function sectionScreen(section, color)
  getJSON(SITE .. "/" .. section .. "/tts.json", color, true, function(data)
    local items = {}
    for _, g in ipairs(data.groups or {}) do
      local n = #g.events
      local decks = g.events[1].decks
      table.insert(items, {
        label = g.label,
        bar = ACCENT,
        right = { text = n > 1 and count(n, "event") or (decks and count(decks, "deck") or "1 event") },
        -- A group of one (a regional) goes straight to its decks.
        open = function(c)
          if n == 1 then
            deckScreen(section, g.events[1].id, c)
          else
            push({ title = g.label, items = eventItems(section, g.events), page = 1 })
          end
        end,
      })
    end
    push({ title = data.title, items = items, page = 1 })
  end)
end

local HOME = {
  home = true,
  title = "Deck Importer",
  items = {
    { label = "Browse decklists", bar = ACCENT, right = { text = "by format" },
      open = function(c) sectionScreen("lists", c) end },
    { label = "Browse majors", bar = ACCENT, right = { text = "by season" },
      open = function(c) sectionScreen("majors", c) end },
  },
  page = 1,
}

-- ── Rendering ───────────────────────────────────────────────────────────────

-- Buttons need a named function in this script, so each row gets one.
for i = 1, ROWS do
  _G["onRow" .. i] = function(_, color)
    local screen = stack[#stack]
    local item = screen.items[(screen.page - 1) * ROWS + i]
    if item and not busy then item.open(color) end
  end
end

function onBack()
  if #stack > 1 then table.remove(stack) render() end
end

function onPrev()
  local screen = stack[#stack]
  if screen.page > 1 then screen.page = screen.page - 1 render() end
end

function onNext()
  local screen = stack[#stack]
  if screen.page * ROWS < #screen.items then screen.page = screen.page + 1 render() end
end

function noop() end

local function button(params)
  params.function_owner = self
  params.click_function = params.click_function or "noop"
  params.position = { params.x or 0, Y, params.z }
  params.x, params.z = nil, nil
  params.font_size = params.font_size or FONT
  if params.color and not params.hover_color then
    params.hover_color = lighten(params.color, 0.15)
    params.press_color = lighten(params.color, 0.3)
  end
  self.createButton(params)
end

-- Chips are as wide as the widest on the screen, so the columns line up from
-- row to row and page to page.
local function chipColumns(screen)
  if not screen.leftW then
    local l, r = 0, 0
    for _, item in ipairs(screen.items) do
      if item.left then l = math.max(l, chipWidth(item.left.text)) end
      if item.right then r = math.max(r, chipWidth(item.right.text)) end
    end
    screen.leftW, screen.rightW = l, r
  end
  return screen.leftW, screen.rightW
end

-- A row is laid out left to right: bar, left chip, label, right chip. The
-- label takes the room the rest leave, and every piece clicks the row.
local function drawRow(i, item, leftW, rightW)
  local z = TOP + (i - 1) * ROW_STEP
  local x = ROW_LEFT
  local function piece(w, label, color, font_color)
    button({ label = label, tooltip = item.tooltip or "", click_function = "onRow" .. i,
      x = x + w / 2, z = z, width = w * 1000, height = ROW_H * 1000,
      color = color, font_color = font_color })
    x = x + w + GAP
  end
  if item.bar then piece(BAR_W, "", item.bar, TEXT) end
  if item.left then
    piece(leftW, item.left.text, item.left.color or CHIP, item.left.font_color or MUTED)
  end
  local labelW = ROW_RIGHT - x - (item.right and (rightW + GAP) or 0)
  piece(labelW, fit(item.label, labelW), i % 2 == 1 and ROW_A or ROW_B, TEXT)
  if item.right then
    piece(rightW, item.right.text, item.right.color or CHIP, item.right.font_color or MUTED)
  end
end

render = function()
  self.clearButtons()
  self.clearInputs()
  local screen = stack[#stack]
  local pages = math.max(1, math.ceil(#screen.items / ROWS))

  -- The title sits on the header band painted into the tile's image.
  local title = busy and "Loading..." or screen.title
  if pages > 1 then title = title .. "  (" .. screen.page .. "/" .. pages .. ")" end
  button({ label = fit(title, ROW_RIGHT - ROW_LEFT), z = HEADER_Z, width = 1900, height = 140,
    color = CLEAR, hover_color = CLEAR, press_color = CLEAR,
    font_color = busy and MUTED or TEXT, font_size = FONT + 6 })

  local leftW, rightW = chipColumns(screen)
  for i = 1, ROWS do
    local item = screen.items[(screen.page - 1) * ROWS + i]
    if item then drawRow(i, item, leftW, rightW) end
  end

  if screen.home then
    self.createInput({
      input_function = "onLinkInput",
      function_owner = self,
      label = "...or paste a builduvs.com deck link",
      alignment = 3,
      position = { 0, Y, TOP + 4 * ROW_STEP },
      width = (ROW_RIGHT - ROW_LEFT) * 1000,
      height = ROW_H * 1000,
      font_size = FONT,
      color = ROW_A,
      font_color = TEXT,
      tooltip = "A deck from builduvs.com/lists or builduvs.com/majors",
      value = link,
    })
    button({ label = "Import link", click_function = "onImportClick",
      z = TOP + 5 * ROW_STEP, width = 800, height = ROW_H * 1000,
      color = ACCENT, font_color = WHITE, tooltip = "Spawn the pasted deck" })
    return
  end

  button({ label = "Back", click_function = "onBack", z = NAV_Z, width = 560, height = 130,
    color = ACCENT, font_color = WHITE })
  if screen.page > 1 then
    button({ label = "< Prev", click_function = "onPrev", x = -0.7, z = NAV_Z,
      width = 500, height = 130, color = CHIP, font_color = TEXT })
  end
  if screen.page < pages then
    button({ label = "Next >", click_function = "onNext", x = 0.7, z = NAV_Z,
      width = 500, height = 130, color = CHIP, font_color = TEXT })
  end
end

-- ── TTS events ──────────────────────────────────────────────────────────────

function onLoad()
  stack = { HOME }
  render()
  self.addContextMenuItem("Import pasted link", function(color) importDeck(color) end)
  self.addContextMenuItem("Importer home", function()
    stack = { HOME }
    render()
  end)
end

function onImportClick(_, color)
  importDeck(color)
end

-- Enter in the box arrives as a trailing newline: treat it as Import.
function onLinkInput(_, color, value, editing)
  if value:find("\n") then
    link = trim(value:gsub("\n", ""))
    importDeck(color)
    return link
  end
  link = value
end
