/**
 * Raj Traders - PHOTO SERVICE
 * A small separate script. Your catalogue script stays exactly as it is.
 *
 * SETUP (5 steps, about 5 minutes, all on the phone)
 * 1. script.google.com -> New project -> delete the sample code -> paste this whole file -> Save.
 * 2. Put your Sheet's ID in SHEET_ID below (the long text in the Sheet's web address, between /d/ and /edit).
 * 3. Choose the function "authorize" -> Run -> Review permissions -> Allow.
 * 4. Deploy -> New deployment -> Web app -> Execute as: Me -> Who has access: Anyone -> Deploy. Copy the web app URL.
 * 5. In the app: tap the logo 5 times -> PIN -> Tools -> Photo service -> paste the URL -> Test -> Save.
 */
var SHEET_ID = '';        // REQUIRED: paste your Sheet ID here
var SHEET_NAME = '';      // leave blank to use the first tab
var NAME_COL = 1;         // same columns as your catalogue script
var PHOTO_COL = 4;
var FIRST_ROW = 2;
var PHOTO_FOLDER = 'RajTraders Photos';
var ASSET_FOLDER = 'RajTraders Assets';
var MAX_B64 = 4500000;

function doGet() { return out_({ status: 'ok', service: 'photo' }); }

function doPost(e) {
  try {
    var b = JSON.parse(e.postData.contents);
    if (b.action === 'photo') return out_(photo_(b));
    if (b.action === 'asset') return out_(asset_(b));
    return out_({ status: 'error', message: 'Unknown action' });
  } catch (err) {
    return out_({ status: 'error', message: String(err && err.message || err) });
  }
}

function out_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}

function sheet_() {
  if (!SHEET_ID) throw new Error('Set SHEET_ID at the top of the photo service script');
  var ss = SpreadsheetApp.openById(SHEET_ID);
  var sh = SHEET_NAME ? ss.getSheetByName(SHEET_NAME) : ss.getSheets()[0];
  if (!sh) throw new Error('Sheet tab not found. Check SHEET_NAME');
  return sh;
}

function folder_(name) {
  var it = DriveApp.getFoldersByName(name);
  return it.hasNext() ? it.next() : DriveApp.createFolder(name);
}

function save_(b64, folderName, prefix) {
  if (!b64 || b64.length > MAX_B64) throw new Error('Photo missing or too large');
  var blob = Utilities.newBlob(Utilities.base64Decode(b64), 'image/jpeg', prefix + '-' + Date.now() + '.jpg');
  var f = folder_(folderName).createFile(blob);
  f.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  return 'https://drive.google.com/uc?id=' + f.getId();
}

// Ads and brand logos: saved in Drive, link returned (the Sheet is not touched).
function asset_(b) {
  var name = String(b.name || 'asset').replace(/[^a-z0-9_-]/gi, '');
  return { status: 'ok', url: save_(b.data, ASSET_FOLDER, name) };
}

// Item photo: saved in Drive, then the link is written into the Photo column of that item's row.
function photo_(b) {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(20000)) return { status: 'error', message: 'Busy. Try again in a moment.' };
  try {
    var sh = sheet_();
    var raw = String(b.rawName || '').trim();
    if (!raw) return { status: 'error', message: 'Missing item name' };
    var last = sh.getLastRow();
    var row = Number(b.row);
    var ok = row >= FIRST_ROW && row <= last && String(sh.getRange(row, NAME_COL).getValue()).trim() === raw;
    if (!ok) { // rows moved: find the item by its exact name, but only if it is unique
      if (last < FIRST_ROW) return { status: 'error', message: 'Sheet is empty' };
      var vals = sh.getRange(FIRST_ROW, NAME_COL, last - FIRST_ROW + 1, 1).getValues();
      var hits = [];
      for (var i = 0; i < vals.length; i++) if (String(vals[i][0]).trim() === raw) hits.push(FIRST_ROW + i);
      if (hits.length !== 1) return { status: 'error', message: 'Item not found or changed. Refresh and try again.' };
      row = hits[0];
    }
    var url = save_(b.data, PHOTO_FOLDER, 'item-' + row);
    sh.getRange(row, PHOTO_COL).setValue(url);
    return { status: 'ok', url: url };
  } finally {
    lock.releaseLock();
  }
}

// Run once to grant access to your Sheet and Drive.
function authorize() {
  sheet_();
  DriveApp.getRootFolder();
  Logger.log('Ready: Sheet and Drive are reachable.');
}
