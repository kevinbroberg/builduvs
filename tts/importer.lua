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

-- How far in front of the importer the piles land, in world units.
local SPAWN_DISTANCE = 8.5

-- Layout, in the tile's local units: it spans -1..1 on x and z, and local -z is
-- the far edge (the top, read from the seat the importer faces).
--
-- Button width/height/font_size use their own units. U converts: measured in
-- TTS, the tile's full width (2 local units) is about 1000 button units. If
-- every button comes out too big or too small, U is the one number to change;
-- if they're hidden under the tile or float too high, change Y.
local U = 500
local Y = 0.6              -- height above the tile's centre
local ROWS = 9             -- list rows per page
local TOP = -0.66          -- z of the first row
local ROW_STEP = 0.16      -- z between rows
local ROW_H = 0.14         -- row height, leaving a gap between rows
local ROW_W = 1.9          -- row width, inside the tile's 2
local HEADER_Z = -0.86
local NAV_Z = 0.86
local FONT = math.floor(0.065 * U)

local DARK = { 0.12, 0.12, 0.14 }
local ROW_COLOR = { 0.95, 0.95, 0.95 }
local ACCENT = { 0.1, 0.45, 0.85 }
local WHITE = { 1, 1, 1 }

local link = ""
local busy = false

-- The screen being shown, and the ones under it for Back. A screen is
-- { title, items = { {label, tooltip, open} }, page } or the home screen.
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

local function spawnDeck(data)
  local origin = self.getPosition()
  -- Upright for White is Y 180 (the same as the cards), so measure from there.
  local turn = self.getRotation().y - 180
  local count = 0
  for _, obj in ipairs(data.ObjectStates) do
    stripScripts(obj)
    local t = obj.Transform or {}
    -- Keep the file's left-to-right layout (face, deck, sideboard), turned to
    -- match the importer so the piles face whoever it is facing.
    local offset = Vector(t.posX or 0, 1, -SPAWN_DISTANCE):rotateOver("y", turn)
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
    if spawnDeck(data) == 0 then
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
    for _, d in ipairs(data.decks or {}) do
      local url = SITE .. "/" .. section .. "/" .. event .. "/" .. d[1] .. "/tts.json"
      table.insert(items, {
        label = d[2],
        tooltip = (d[3] ~= "" and (d[3] .. " — ") or "") .. "click to spawn",
        open = function(c) importFrom(url, c) end,
      })
    end
    push({ title = data.title, items = items, page = 1 })
  end)
end

local function eventItems(section, events)
  local items = {}
  for _, ev in ipairs(events) do
    table.insert(items, {
      label = ev.label,
      open = function(c) deckScreen(section, ev.id, c) end,
    })
  end
  return items
end

local function sectionScreen(section, color)
  getJSON(SITE .. "/" .. section .. "/tts.json", color, true, function(data)
    local items = {}
    for _, g in ipairs(data.groups or {}) do
      local n = #g.events
      table.insert(items, {
        label = g.label .. (n > 1 and (" (" .. n .. " events)") or ""),
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
  title = "BuildUVS Deck Importer",
  items = {
    { label = "Browse decklists", open = function(c) sectionScreen("lists", c) end },
    { label = "Browse majors", open = function(c) sectionScreen("majors", c) end },
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
  self.createButton(params)
end

render = function()
  self.clearButtons()
  self.clearInputs()
  local screen = stack[#stack]
  local pages = math.max(1, math.ceil(#screen.items / ROWS))

  local title = busy and "Loading..." or screen.title
  if pages > 1 then title = title .. "  (" .. screen.page .. "/" .. pages .. ")" end
  button({ label = title, z = HEADER_Z, width = 1.95 * U, height = 0.15 * U,
    color = DARK, font_color = WHITE })

  for i = 1, ROWS do
    local item = screen.items[(screen.page - 1) * ROWS + i]
    if item then
      button({ label = item.label, tooltip = item.tooltip or "", click_function = "onRow" .. i,
        z = TOP + (i - 1) * ROW_STEP, width = ROW_W * U, height = ROW_H * U,
        color = ROW_COLOR, font_color = DARK })
    end
  end

  if screen.home then
    self.createInput({
      input_function = "onLinkInput",
      function_owner = self,
      label = "...or paste a builduvs.com deck link",
      alignment = 3,
      position = { 0, Y, TOP + 4 * ROW_STEP },
      width = ROW_W * U,
      height = ROW_H * U,
      font_size = FONT,
      tooltip = "A deck from builduvs.com/lists or builduvs.com/majors",
      value = link,
    })
    button({ label = "Import link", click_function = "onImportClick",
      z = TOP + 5 * ROW_STEP, width = 0.8 * U, height = ROW_H * U,
      color = ACCENT, font_color = WHITE, tooltip = "Spawn the pasted deck" })
    return
  end

  button({ label = "Back", click_function = "onBack", z = NAV_Z, width = 0.5 * U, height = ROW_H * U,
    color = ACCENT, font_color = WHITE })
  if screen.page > 1 then
    button({ label = "< Prev", click_function = "onPrev", x = -0.7, z = NAV_Z,
      width = 0.5 * U, height = ROW_H * U, color = DARK, font_color = WHITE })
  end
  if screen.page < pages then
    button({ label = "Next >", click_function = "onNext", x = 0.7, z = NAV_Z,
      width = 0.5 * U, height = ROW_H * U, color = DARK, font_color = WHITE })
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
