-- BuildUVS Deck Importer — a Tabletop Simulator object that loads a decklist
-- straight from builduvs.com.
--
-- Paste a deck's link (e.g. https://builduvs.com/lists/<event>/<rank>) into the
-- box and press Import, or press Enter. The deck is fetched from that page's
-- /tts.json endpoint (netlify/edge-functions/deck-tts.js) and spawned in front
-- of the importer: character face up, main deck and sideboard face down.
--
-- This is the source. scripts/gen-tts-importer.mjs packs it into the saved
-- object public/tts/builduvs-importer.json — edit here, then re-run that.

-- Only these hosts are fetched from. The importer spawns whatever the response
-- describes, so it must not be pointable at an arbitrary URL.
local HOSTS = { ["builduvs.com"] = true, ["www.builduvs.com"] = true }
local SITE = "https://builduvs.com"

-- How far in front of the importer the piles land, in world units.
local SPAWN_DISTANCE = 4.5

local link = ""
local busy = false

function onLoad()
  self.createInput({
    input_function = "onLinkInput",
    function_owner = self,
    label = "Paste a builduvs.com deck link",
    alignment = 3,
    position = { 0, 0.15, 0.45 },
    width = 1850,
    height = 150,
    font_size = 80,
    tooltip = "A deck from builduvs.com/lists or builduvs.com/majors",
  })
  self.createButton({
    click_function = "onImportClick",
    function_owner = self,
    label = "Import",
    position = { 0, 0.15, 0.8 },
    width = 700,
    height = 160,
    font_size = 100,
    color = { 0.1, 0.45, 0.85 },
    font_color = { 1, 1, 1 },
    tooltip = "Spawn the deck in front of this importer",
  })
  self.addContextMenuItem("Import deck", function(color) importDeck(color) end)
end

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

local function tell(color, message, tint)
  if color and Player[color] and Player[color].seated then
    broadcastToColor(message, color, tint or { 1, 1, 1 })
  else
    broadcastToAll(message, tint or { 1, 1, 1 })
  end
end

local function setBusy(state)
  busy = state
  self.editButton({ index = 0, label = state and "Loading..." or "Import" })
end

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

function importDeck(color)
  if busy then return end
  local url, problem = ttsUrl(link)
  if not url then
    tell(color, problem, { 1, 0.6, 0.3 })
    return
  end

  setBusy(true)
  WebRequest.get(url, function(req)
    setBusy(false)
    if req.is_error then
      tell(color, "Couldn't reach builduvs.com: " .. tostring(req.error), { 1, 0.4, 0.4 })
      return
    end
    if req.response_code == 404 then
      tell(color, "No decklist found at that link.", { 1, 0.6, 0.3 })
      return
    end
    if req.response_code ~= 200 then
      tell(color, "builduvs.com answered " .. tostring(req.response_code) .. ". Try again shortly.", { 1, 0.4, 0.4 })
      return
    end

    local ok, data = pcall(JSON.decode, req.text)
    if not ok or type(data) ~= "table" or type(data.ObjectStates) ~= "table" then
      tell(color, "That link didn't return a deck.", { 1, 0.4, 0.4 })
      return
    end
    if spawnDeck(data) == 0 then
      tell(color, "That deck has no cards with images.", { 1, 0.6, 0.3 })
      return
    end
    -- The main deck is the first real pile; the face card is a lone card.
    local name = "deck"
    for _, obj in ipairs(data.ObjectStates) do
      if obj.Name == "Deck" then name = obj.Nickname break end
    end
    tell(color, "Imported " .. name, { 0.5, 1, 0.5 })
  end)
end

function onImportClick(_, color)
  importDeck(color)
end

-- Enter in the box arrives as a trailing newline: treat it as pressing Import.
function onLinkInput(_, color, value, editing)
  if value:find("\n") then
    link = trim(value:gsub("\n", ""))
    importDeck(color)
    return link
  end
  link = value
end
