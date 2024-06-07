/*
 *	poor man's error handling -- $fixme
 */
var easyMartina = false;

window.onerror = function (message, file, line, col, e) {
  var cb1;
  if (!easyMartina) alert("Error occurred: " + e.message);
  return false;
};

window.addEventListener("error", function (e) {
  var cb2;
  if (!easyMartina) alert("Error occurred: " + e.error.message);
  return false;
});

/*
 *	notes / lists / boards
 */
function addNote($list, $after, $before) {
  var $note = $("tt .note").clone();
  var $notes = $list.find(".notes");

  $note.find(".text").html("");
  $note.addClass("brand-new");

  if ($before && $before.length) {
    $before.before($note);
    $note = $before.prev();
  } else if ($after && $after.length) {
    $after.after($note);
    $note = $after.next();
  } else {
    $notes.append($note);
    $note = $notes.find(".note").last();
  }

  $note.find(".text").click();
}

function deleteNote($note) {
  $note
    .animate({ opacity: 0 }, "fast")
    .slideUp("fast")
    .queue(function () {
      $note.remove();
      saveBoard();
    });
}

function noteLocation($item) {
  var loc = 0;
  for (var $p = $item.closest(".note"); $p.length; $p = $p.prev(), loc += 1);
  for (
    var $p = $item.closest(".list");
    $p.length;
    $p = $p.prev(), loc += 10000
  );
  return loc;
}

//
function addList() {
  var $board = $(".wrap .board");
  var $lists = $board.find(".lists");
  var $list = $("tt .list").clone();

  $list.find(".text").html("");
  $list.find(".head").addClass("brand-new");

  $lists.append($list);
  $board.find(".lists .list .head .text").last().click();

  var lists = $lists[0];
  lists.scrollLeft = Math.max(0, lists.scrollWidth - lists.clientWidth);

  setupListScrolling();
}

function deleteList($list) {
  var empty = true;

  $list.find(".note .text").each(function () {
    empty &= $(this).html().length == 0;
  });

  if (!empty && !confirm("Delete this list and all its notes?")) return;

  $list.animate({ opacity: 0 }).queue(function () {
    $list.remove();
    saveBoard();
  });

  setupListScrolling();
}

function moveList($list, left) {
  var $a = $list;
  var $b = left ? $a.prev() : $a.next();

  var $menu_a = $a.find("> .head .menu .bulk");
  var $menu_b = $b.find("> .head .menu .bulk");

  var pos_a = $a.offset().left;
  var pos_b = $b.offset().left;

  $a.css({ position: "relative" });
  $b.css({ position: "relative" });

  $menu_a.hide();
  $menu_b.hide();

  $a.animate({ left: pos_b - pos_a + "px" }, "fast");
  $b.animate({ left: pos_a - pos_b + "px" }, "fast", function () {
    if (left) $list.prev().before($list);
    else $list.before($list.next());

    $a.css({ position: "", left: "" });
    $b.css({ position: "", left: "" });

    $menu_a.css({ display: "" });
    $menu_b.css({ display: "" });

    saveBoard();
  });
}

//
function openBoard(board_id) {
  closeBoard(true);

  NB.board = NB.storage.loadBoard(board_id, null);
  NB.storage.setActiveBoard(board_id);

  showBoard(true);
}

function reopenBoard(revision) {
  var board_id = NB.board.id;

  var via_menu = $(".wrap .board > .head .menu .bulk").is(":visible");

  NB.storage.setBoardRevision(board_id, revision);

  openBoard(board_id);

  if (via_menu) {
    var $menu = $(".wrap .board > .head .menu");
    var $teaser = $menu.find(".teaser");
    var $bulk = $menu.find(".bulk");

    $teaser
      .hide()
      .delay(100)
      .queue(function () {
        $(this).css("display", "").dequeue();
      });
    $bulk
      .show()
      .delay(100)
      .queue(function () {
        $(this).css("display", "").dequeue();
      });
  }
}

function closeBoard(quick) {
  if (!NB.board) return;

  var $board = $(".wrap .board");

  if (quick) $board.remove();
  else
    $board.animate({ opacity: 0 }, "fast").queue(function () {
      $board.remove();
    });

  NB.board = null;
  NB.storage.setActiveBoard(null);

  //		updateUndoRedo();
  updateBoardIndex();
  updatePageTitle();
}

//
function addBoard() {
  closeBoard(true);

  NB.board = new Board();

  showBoard(true);

  $(".wrap .board .head").addClass("brand-new");
  $(".wrap .board .head .text").click();
}

function saveBoard() {
  var $board = $(".wrap .board");
  var board = Object.assign(new Board(), NB.board); // id, revision & title

  board.lists = [];

  $board.find(".list").each(function () {
    var $list = $(this);
    var l = board.addList(getText($list.find(".head .text")));

    $list.find(".note").each(function () {
      var $note = $(this);
      var n = l.addNote(getText($note.find(".text")));
      n.raw = $note.hasClass("raw");
      n.min = $note.hasClass("collapsed");
    });
  });

  NB.storage.saveBoard(board);
  NB.board = board;

  updateUndoRedo();
  updateBoardIndex();
}

function deleteBoard() {
  var $list = $(".wrap .board .list");
  var board_id = NB.board.id;

  if (
    $list.length &&
    !confirm("PERMANENTLY delete this board, all its lists and their notes?")
  )
    return;

  closeBoard();

  NB.storage.nukeBoard(board_id);

  updateBoardIndex();
}

//
function undoBoard() {
  if (!NB.board) return false;

  var hist = NB.storage.getBoardHistory(NB.board.id);
  var have = NB.board.revision;
  var want = 0;

  for (var i = 0; i < hist.length - 1 && !want; i++)
    if (have == hist[i]) want = hist[i + 1];

  if (!want) {
    console.log("Undo - failed");
    return false;
  }

  console.log("Undo -> " + want);

  reopenBoard(want);
  return true;
}

function redoBoard() {
  if (!NB.board) return false;

  var hist = NB.storage.getBoardHistory(NB.board.id);
  var have = NB.board.revision;
  var want = 0;

  for (var i = 1; i < hist.length && !want; i++)
    if (have == hist[i]) want = hist[i - 1];

  if (!want) {
    console.log("Redo - failed");
    return false;
  }

  console.log("Redo -> " + want);

  reopenBoard(want);
  return true;
}

//
function showBoard(quick) {
  var board = NB.board;

  var $wrap = $(".wrap");
  var $bdiv = $("tt .board");
  var $ldiv = $("tt .list");
  var $ndiv = $("tt .note");

  var $b = $bdiv.clone();
  var $b_lists = $b.find(".lists");

  $b[0].board_id = board.id;
  setText($b.find(".head .text"), board.title);

  board.lists.forEach(function (list) {
    var $l = $ldiv.clone();
    var $l_notes = $l.find(".notes");

    setText($l.find(".head .text"), list.title);

    list.notes.forEach(function (n) {
      var $n = $ndiv.clone();
      setText($n.find(".text"), n.text);
      if (n.raw) $n.addClass("raw");
      if (n.min) $n.addClass("collapsed");
      $l_notes.append($n);
    });

    $b_lists.append($l);
  });

  if (quick) $wrap.html("").append($b);
  else $wrap.html("").css({ opacity: 0 }).append($b).animate({ opacity: 1 });

  updatePageTitle();
  updateUndoRedo();
  updateBoardIndex();
  setupListScrolling();
}

/*
 *	demo board
 */
function createDemoBoard() {
  var blob =
    '{"format":20190412,"id":1555071015420,"revision":581,"title":"Welcome to Nullboard","lists":[{"title":"The Use' +
    'r Manual","notes":[{"text":"This is a note.\\nA column of notes is a list.\\nA set of lists is a board.","raw"' +
    ':false,"min":false},{"text":"All data is saved locally.\\nThe whole thing works completely offline.","raw":fal' +
    'se,"min":false},{"text":"Last 50 board revisions are retained.","raw":false,"min":false},{"text":"Ctrl-Z is Un' +
    'do  -  goes one revision back.\\nCtrl-Y is Redo  -  goes one revision forward.","raw":false,"min":false},{"tex' +
    't":"Caveats","raw":true,"min":false},{"text":"Desktop-oriented.\\nMobile support is basically untested.","raw"' +
    ':false,"min":false},{"text":"Works in Firefox, Chrome is supported.\\nShould work in Safari, may work in Edge.' +
    '","raw":false,"min":false},{"text":"Still very much in beta. Caveat emptor.","raw":false,"min":false},{"text":' +
    '"Issues and suggestions","raw":true,"min":false},{"text":"Post them on Github.\\nSee \\"Nullboard\\" at the to' +
    'p left for the link.","raw":false,"min":false}]},{"title":"Things to try","notes":[{"text":"\u2022   Click on ' +
    'a note to edit.","raw":false,"min":false},{"text":"\u2022   Click outside of it when done editing.\\n\u2022   ' +
    'Alternatively, use Shift-Enter.","raw":false,"min":false},{"text":"\u2022   To discard changes press Escape.",' +
    '"raw":false,"min":false},{"text":"\u2022   Try Ctrl-Enter, see what it does.\\n\u2022   Try Ctrl-Shift-Enter t' +
    'oo.","raw":false,"min":false},{"text":"\u2022   Hover over a note to show its  \u2261  menu.\\n\u2022   Hover ' +
    'over  \u2261  to reveal the options.","raw":false,"min":false},{"text":"\u2022   X  deletes the note.\\n\u2022' +
    '   R changes how a note looks.\\n\u2022   _  collapses the note.","raw":false,"min":false},{"text":"This is a ' +
    'raw note.","raw":true,"min":false},{"text":"This is a collapsed note. Only its first line is visible. Useful f' +
    'or keeping lists compact.","raw":false,"min":true}, {"text":"Links","raw":true,"min":false}, {"text":"Links pu' +
    'lse on hover and can be opened via the right-click menu  -  https://nullboard.io","raw":false,"min":false}, {"tex' +
    't":"Pressing CapsLock or Control highlights all links and makes them left-clickable.","raw":false,"min":false}]},{"title"' +
    ':"More things to try","notes":[{"text":"\u2022   Drag notes around to rearrange.\\n\u2022   Works between the ' +
    'lists too.","raw":false,"min":false},{"text":"\u2022   Click on a list name to edit.\\n\u2022   Enter to save,' +
    ' Esc to cancel.","raw":false,"min":false},{"text":"\u2022   Try adding a new list.\\n\u2022   Try deleting one' +
    '. This  _can_  be undone.","raw":false,"min":false},{"text":"\u2022   Same for the board name.","raw":false,"m' +
    'in":false},{"text":"Boards","raw":true,"min":false},{"text":"\u2022   Check out   \u2261   at the top right.",' +
    '"raw":false,"min":false},{"text":"\u2022   Try adding a new board.\\n\u2022   Try switching between the boards' +
    '.","raw":false,"min":false},{"text":"\u2022   Try deleting a board. Unlike deleting a\\n     list this  _canno' +
    't_  be undone.","raw":false,"min":false},{"text":"\u2022   Export the board   (save to a file, as json)\\n' +
    '\u2022   Import the board   (load from a save)","raw":false,"min":false}]}]}';

  var demo = JSON.parse(blob);

  if (!demo) return false;

  demo.id = +new Date();
  demo.revision = 0;

  NB.storage.saveBoard(demo);
  NB.storage.setActiveBoard(demo.id);

  return Object.assign(new Board(), demo);
}

/*
 *	board export / import
 */
function exportBoard() {
  var blob, file;

  if (!NB.board) {
    var index = NB.storage.getBoardIndex();
    var all = [];

    boards.forEach(function (meta, board_id) {
      all.push(NB.storage.loadBoard(board_id, null));
    });

    blob = JSON.stringify(all);
    file = `Nullboard.nbx`;
  } else {
    var board = NB.board;
    blob = JSON.stringify(board);
    file = `Nullboard-${board.id}-${board.title}.nbx`;
  }

  blob = encodeURIComponent(blob);
  blob = "data:application/octet-stream," + blob;

  return { blob: blob, file: file };
}

function checkImport(foo) {
  var props = ["format", "id", "revision", "title", "lists"];

  for (var i = 0; i < props.length; i++)
    if (!foo.hasOwnProperty(props[i]))
      return "Required board properties are missing.";

  if (!foo.id || !foo.revision || !Array.isArray(foo.lists))
    return "Required board properties are empty.";

  if (foo.format != NB.blobVersion)
    return `Unsupported blob format "${foo.format}", expecting "${NB.blobVersion}".`;

  return null;
}

function importBoard(blob) {
  var data;

  try {
    data = JSON.parse(blob);
  } catch (x) {
    alert("File is not in a valid JSON format.");
    return false;
  }

  if (!Array.isArray(data)) data = [data];

  var index = NB.storage.getBoardIndex();
  var msg,
    one,
    all = "";

  for (var i = 0; i < data.length; i++) {
    var board = data[i];

    var whoops = checkImport(board);
    if (whoops) {
      alert(whoops);
      return false;
    }

    var title = board.title || "(untitled board)";
    one = `"${title}", ID ${board.id}, revision ${board.revision}`;
    all += `    ID ${board.id}, revision ${board.revision} - "${title}"    \n`;
  }

  if (data.length == 1) msg = `Import a board called ${one} ?`;
  else msg = `About to import the following boards:\n\n${all}\nProceed?`;

  if (!confirm(msg)) return false;

  var to_open = "";

  for (var i = 0; i < data.length; i++) {
    var board = data[i];
    var check_title = true;

    // check ID

    if (index.has(board.id)) {
      var which = data.length == 1 ? "with the same ID" : board.id;

      if (
        confirm(`Board ${which} already exists. Overwrite it?`) &&
        confirm(`OVERWRITE for sure?`)
      ) {
        console.log(
          `Import: ${board.id} (${board.title} - will overwrite existing one`
        );
        check_title = false;
      } else if (confirm(`Import the board under a new ID?`)) {
        var new_id = +new Date();
        console.log(
          `Import: ${board.id} (${board.title} - will import as ${new_id}`
        );
        board.id = new_id;
      } else {
        console.log(
          `Import: ${board.id} (${board.title} - ID conflict, will not import`
        );
        continue;
      }
    }

    if (check_title) {
      var retitle = false;
      index.forEach((have) => {
        retitle |= have.title == board.title;
      });

      if (retitle) board.title += " (imported)";
    }

    // ok, do the deed

    board.revision--; // save will ++ it back

    if (!NB.storage.saveBoard(board)) {
      // this updates 'index'
      alert(`Failed to save board ${board.id}. Import failed.`);
      return false;
    }

    if (!to_open) to_open = data[0].id;
  }

  if (to_open) openBoard(to_open);
}

/*
 *
 */
function findBackupAgent(which) {
  var a = null;

  NB.storage.backups.agents.forEach(function (agent) {
    if (
      agent.type == which.type &&
      agent.conf.auth == which.conf.auth &&
      agent.conf.base == which.conf.base
    ) {
      a = agent;
    }
  });

  return a;
}

function setBackupConfigUi($div, backupConf) {
  if (!backupConf.enabled) {
    $div.addClass("off");
    return;
  }

  var $status = $div.find(".status");
  var b = findBackupAgent(backupConf);
  var text = "OK";

  if (b && b.status == "error") {
    text = b.lastXhr.text;
    $status.addClass("error");
  }

  $status.find("input").val(text);
  $status.css({ display: "block" });
}

function getBackupConfigUi() {
  var conf = NB.storage.getConfig();
  var loc = conf.backups.agents[0];
  var rem = conf.backups.agents[1];

  var $div = $(".overlay .backup-conf");
  var $loc = $div.find(".loc");
  var $rem = $div.find(".rem");

  var ret = {
    loc: jsonClone(loc),
    rem: jsonClone(rem),
  };

  ret.loc.enabled = !$loc.hasClass("off");
  ret.loc.conf.auth = $loc.find(".auth").val();

  ret.rem.enabled = !$rem.hasClass("off");
  ret.rem.conf.base = $rem.find(".base").val();
  ret.rem.conf.auth = $rem.find(".auth").val();

  //
  if (ret.loc.enabled && !ret.loc.conf.auth) {
    shakeControl($loc.find(".auth"));
    return null;
  }

  if (ret.rem.enabled && !ret.rem.conf.base) {
    shakeControl($rem.find(".base"));
    return null;
  }

  if (ret.rem.enabled && !ret.rem.conf.auth) {
    shakeControl($rem.find(".auth"));
    return null;
  }

  return ret;
}

function checkBackupConfig(backupConf, $div, onDone) {
  var $status = $div.find(".status");
  var $text = $status.find("input");

  $text.val("Checking...");
  $status.removeClass("error").slideDown();

  $div.delay(850).queue(function () {
    var T = NB.backupTypes.get(backupConf.type);
    var foo = new T(backupConf.id, backupConf.conf, function () {});

    foo.checkStatus(function (ok) {
      if (ok) {
        $text.val("OK");
      } else {
        $text.val(foo.lastXhr.text);
        $status.addClass("error");
      }

      onDone();
    });

    $(this).dequeue();
  });
}

function configBackups() {
  var conf = NB.storage.getConfig();

  if (conf.backups.agents.length != 2) throw "Invalid conf.backups.agents[]"; // as per fixupConfig()

  //
  var $div = $("tt .backup-conf").clone();
  var div = $div[0];

  var $loc = $div.find(".loc");
  var $rem = $div.find(".rem");

  var typ = new SimpleBackup().type;
  var loc = conf.backups.agents[0];
  var rem = conf.backups.agents[1];

  div.checking = 0;

  //
  $loc.find(".auth").val(loc.conf.auth);
  $rem.find(".auth").val(rem.conf.auth);
  $rem.find(".base").val(rem.conf.base);

  setBackupConfigUi($loc, loc);
  setBackupConfigUi($rem, rem);

  if (!loc.enabled && !rem.enabled) $div.addClass("off");

  //
  $div.find(".opt").click(function () {
    var $opt = $(this).parent();

    if ($opt.hasClass("off")) {
      $opt
        .find(".etc")
        .css({ opacity: 0 })
        .slideDown("fast")
        .animate({ opacity: 1 }, "fast")
        .queue(function () {
          $opt.removeClass("off");
          $div.removeClass("off");
          $(this).css("opacity", "").dequeue();
        });

      $opt
        .find("input")
        .first()
        .delay(800)
        .queue(function () {
          $(this).focus().dequeue();
        });
    } else {
      $opt
        .find(".etc")
        .animate({ opacity: 0 }, "fast")
        .slideUp("fast")
        .queue(function () {
          $opt.addClass("off");
          if ($loc.hasClass("off") && $rem.hasClass("off"))
            $div.addClass("off");
          $(this).css({ opacity: "" }).dequeue();
        });
    }

    return false;
  });

  $div.find(".check").click(function () {
    if (div.checking) return false;

    var foo = getBackupConfigUi();
    if (!foo) return false;

    if (foo.loc.enabled) {
      div.checking++;
      checkBackupConfig(foo.loc, $loc, function () {
        div.checking--;
      });
    }

    if (foo.rem.enabled) {
      div.checking++;
      checkBackupConfig(foo.rem, $rem, function () {
        div.checking--;
      });
    }

    return false;
  });

  $div.find(".ok").click(function () {
    var foo = getBackupConfigUi();
    if (!foo) return false;

    if (foo.loc.enabled && !loc.enabled)
      foo.loc.id = typ + "-" + conf.backups.nextId++;

    if (foo.rem.enabled && !rem.enabled)
      foo.rem.id = typ + "-" + conf.backups.nextId++;

    conf.backups.agents[0] = foo.loc;
    conf.backups.agents[1] = foo.rem;

    NB.storage.initBackups(onBackupStatusChange);
    NB.storage.saveConfig();

    hideOverlay();
  });

  $div.find("a.close").click(function () {
    hideOverlay();
  });

  showOverlay($div);
}

function onBackupStatusChange(agent) {
  var agents = NB.storage.backups.agents;

  var $config = $(".config");
  var $status = $(".config .teaser u");

  //		if (agent) console.log( `onBackupStatusChange: ${agent.id}, status ${agent.status}, op ${agent.lastOp}, xhr '${agent.lastXhr.text}' / ${agent.lastXhr.code}` );
  //		else       console.log( `onBackupStatusChange: <generic>` );

  if (!agents.length) {
    $config.removeClass("backups-on backup-err backing-up");
    return;
  }

  $config.addClass("backups-on");

  var busy = 0;
  var error = 0;
  var ready = 0;

  agents.forEach(function (agent) {
    if (agent.status == "busy") busy++;
    else if (agent.status == "error") error++;
    else if (agent.status == "ready") ready++;
    else throw `Unknown status [${agent.status}] on backup agent ${agent.id}`;
  });

  if (error > 0) $config.addClass("backup-err").removeClass("backing-up");
  else if (busy > 0) $config.addClass("backing-up").removeClass("backup-err");
  else $config.removeClass("backing-up backup-err");

  // process all pending backups if needed

  if (!error && !busy) runPendingBackups();
}

function needsBackingUp(backupStatus, fields, agentIds) {
  var stale = false;
  agentIds.forEach(function (id) {
    var obj = backupStatus[id];
    if (obj)
      fields.forEach(function (f) {
        stale = !obj[f];
      });
    else stale = true;
  });

  return stale;
}

function runPendingBackups() {
  console.log("Checking for pending backups...");

  var conf = NB.storage.getConfig();

  var agentIds = [];
  NB.storage.backups.agents.forEach(function (agent) {
    agentIds.push(agent.id);
  });

  if (needsBackingUp(conf.backupStatus, ["conf"], agentIds)) {
    console.log("  Backing up app config...");
    NB.storage.backupConfig();
  }

  var boards = NB.storage.getBoardIndex();

  boards.forEach(function (meta, id) {
    if (!needsBackingUp(meta.backupStatus, ["data", "meta"], agentIds)) return;

    console.log(`  Backing up board ${id}...`);

    var board = NB.storage.loadBoard(id);
    if (!board) return;

    NB.storage.backupBoard(id, board, meta);
  });
}

/*
 *
 */
function saveBoardOrder() {
  var $index = $(".config .load-board");
  var spot = 1;

  $index.each(function () {
    var id = parseInt($(this).attr("board_id"));
    NB.storage.setBoardUiSpot(id, spot++);
  });
}

/*
 *
 */
function updatePageTitle() {
  var title = "Nullboard";

  if (NB.board) {
    title = NB.board.title;
    title = "NB - " + (title || "(untitled board)");
  }

  document.title = title;
}

function updateUndoRedo() {
  var $undo = $(".board .menu .undo-board");
  var $redo = $(".board .menu .redo-board");

  var undo = false;
  var redo = false;

  if (NB.board && NB.board.revision) {
    var history = NB.storage.getBoardHistory(NB.board.id);
    var rev = NB.board.revision;

    undo = rev != history[history.length - 1];
    redo = rev != history[0];
  }

  if (undo) $undo.show();
  else $undo.hide();
  if (redo) $redo.show();
  else $redo.hide();
}

function updateBoardIndex() {
  var $index = $(".config .boards");
  var $export = $(".config .exp-board");
  var $backup = $(".config .auto-backup");
  var $entry = $("tt .load-board");

  var $board = $(".wrap .board");
  var id_now = NB.board && NB.board.id;
  var empty = true;

  $index.html("");
  $index.hide();

  var boards = NB.storage.getBoardIndex();
  var index = [];

  boards.forEach(function (meta, id) {
    index.push({ id: id, meta: meta });
  });

  index.sort(function (a, b) {
    return b.meta.ui_spot && a.meta.ui_spot > b.meta.ui_spot;
  });

  index.forEach(function (entry) {
    var $e = $entry.clone();
    $e.attr("board_id", entry.id);
    $e.html(entry.meta.title);

    if (entry.id == id_now) $e.addClass("active");

    $index.append($e);
    empty = false;
  });

  if (!empty) {
    if (id_now) $export.html("Export this board...").show();
    else $export.html("Export all boards...").show();
    $backup.show();
  } else {
    $export.hide();
    $backup.hide();
  }

  if (!empty) $index.show();
}

function setWhatsNew() {
  var conf = NB.storage.getConfig();

  if (conf.verSeen && conf.verSeen < NB.codeVersion) {
    $(".logo").addClass("updated");
    $(".logo .alert").html("(updated)");
  }

  var $link = $(".logo .view-changes");
  var link = $link.attr("href") + "/?have=" + NB.codeVersion;
  if (conf.verSeen) link += "&seen=" + conf.verSeen;
  if (conf.verLast) link += "&last=" + conf.verLast;
  $link.attr("href", link);
}

/*
 *	generic utils
 */
function jsonMatch(a, b) {
  return JSON.stringify(a) == JSON.stringify(b);
}

function jsonClone(x) {
  return JSON.parse(JSON.stringify(x));
}

function htmlEncode(raw) {
  return $("tt .encoder").text(raw).html();
}

function setText($note, text) {
  $note.attr("_text", text);

  text = htmlEncode(text);

  var hmmm = /\b(https?:\/\/[^\s]+)/gm;
  text = text.replace(hmmm, function (url) {
    return '<a href="' + url + '" target="_blank">' + url + "</a>";
  });

  if (NB.peek("fileLinks")) {
    var xmmm = /`(.*?)`/gm;
    text = text.replace(xmmm, function (full, text) {
      link = "file:///" + text.replace("\\", "/");
      return '`<a href="' + link + '" target="_blank">' + text + "</a>`";
    });
  }

  $note.html(text); // ? text : ' ');
}

function getText($note) {
  return $note.attr("_text");
}

function removeTextSelection() {
  if (window.getSelection) {
    window.getSelection().removeAllRanges();
  } else if (document.selection) {
    document.selection.empty();
  }
}

function shakeControl($x) {
  $x.css({ position: "relative" })
    .focus()
    .animate({ left: "+4px" }, 60)
    .animate({ left: "-3px" }, 60)
    .animate({ left: "+2px" }, 60)
    .animate({ left: "0px" }, 60)
    .queue(function () {
      $x.css({ position: "", left: "" }).dequeue();
    });
}

/*
 *	inline editing
 */
function startEditing($text, ev) {
  var $note = $text.parent();
  var $edit = $note.find(".edit");

  $note[0]._collapsed = $note.hasClass("collapsed");
  $note.removeClass("collapsed");

  $edit.val(getText($text));
  $edit.width($text.width());

  $edit.height($text.height());
  $note.addClass("editing");

  $edit.focus();
}

function stopEditing($edit, via_escape, via_xclick) {
  var $item = $edit.parent();
  if (!$item.hasClass("editing")) return;

  $item.removeClass("editing");
  if ($item[0]._collapsed) $item.addClass("collapsed");

  //
  var $text = $item.find(".text");
  var text_now = $edit.val().trimRight();
  var text_was = getText($text);

  //
  var brand_new = $item.hasClass("brand-new");
  $item.removeClass("brand-new");

  if (via_escape) {
    if (brand_new) $item.closest(".note, .list, .board").remove();
    return;
  }

  if (via_xclick && brand_new && !text_now.length) {
    $item.closest(".note, .list, .board").remove();
    return;
  }

  if (text_now != text_was || brand_new) {
    setText($text, text_now);

    if ($item.parent().hasClass("board")) NB.board.title = text_now;

    updatePageTitle();
    saveBoard();
  }

  //
  if (brand_new && $item.hasClass("list")) addNote($item);
}

function handleTab(ev) {
  var $this = $(this);
  var $note = $this.closest(".note");
  var $sibl = ev.shiftKey ? $note.prev() : $note.next();

  if ($sibl.length) {
    stopEditing($this, false, false);
    $sibl.find(".text").click();
  }
}

//
function setRevealState(ev) {
  var raw = ev.originalEvent;
  var do_reveal =
    raw.getModifierState &&
    (raw.getModifierState("CapsLock") || raw.getModifierState("Control"));

  if (do_reveal) $("body").addClass("reveal");
  else $("body").removeClass("reveal");
}

//
function showDing() {
  $("body")
    .addClass("ding")
    .delay(250)
    .queue(function () {
      $(this).removeClass("ding").dequeue();
    });
}

/*
 *	overlay
 */
function showOverlay($div) {
  $(".overlay")
    .html("")
    .append($div)
    .css({ opacity: 0, display: "flex" })
    .animate({ opacity: 1 });
}

function hideOverlay() {
  $(".overlay").animate({ opacity: 0 }, function () {
    $(this).hide();
  });
}

function haveOverlay() {
  return $(".overlay").css("display") != "none";
}

/*
 *	license popup
 */
function formatLicense() {
  var text = document.head.childNodes[1].nodeValue;
  var pos = text.search("LICENSE");
  var qos = text.search("Software:");
  var bulk;

  bulk = text.substr(pos, qos - pos);
  bulk = bulk.replace(/([^\n])\n\t/g, "$1 ");
  bulk = bulk.replace(/\n\n\t/g, "\n\n");
  bulk = bulk.replace(/([A-Z ]{7,})/g, "<u>$1</u>");

  //
  var c1 = [];
  var c2 = [];

  text
    .substr(qos)
    .trim()
    .split("\n")
    .forEach(function (line) {
      line = line.split(":");
      c1.push(line[0].trim() + ":");
      c2.push(line[1].trim());
    });

  bulk += "<span>" + c1.join("<br>") + "</span>";
  bulk += "<span>" + c2.join("<br>") + "</span>";

  //
  var links = [
    {
      text: "2-clause BSD license",
      href: "https://opensource.org/licenses/BSD-2-Clause/",
    },
    { text: "Commons Clause", href: "https://commonsclause.com/" },
  ];

  links.forEach(function (l) {
    bulk = bulk.replace(
      l.text,
      '<a href="' + l.href + '" target="_blank">' + l.text + "</a>"
    );
  });

  return bulk.trim();
}

/*
 *	adjust this and that
 */
function adjustLayout() {
  var $body = $("body");
  var $board = $(".board");

  if (!$board.length) return;

  var list_w = getListWidth();

  var lists = $board.find(".list").length;
  var lists_w = lists < 2 ? list_w : (list_w + 10) * lists - 10;
  var body_w = $body.width();

  if (lists_w + 190 <= body_w) {
    $board.css("max-width", "");
    $body.removeClass("crowded");
  } else {
    var max = Math.floor((body_w - 10) / (list_w + 20));
    // var max = Math.floor((body_w - 40) / (list_w + 10));
    max = max < 2 ? list_w : (list_w + 50) * max - 20;
    // max = max < 2 ? list_w : (list_w + 10) * max - 10;
    $board.css("max-width", max + "px");
    $body.addClass("crowded");
  }
}

//
function adjustListScroller() {
  var $board = $(".board");
  if (!$board.length) return;

  var $lists = $(".board .lists");
  var $scroller = $(".board .lists-scroller");
  var $inner = $scroller.find("div");

  var max = $board.width();
  var want = $lists[0].scrollWidth;
  var have = $inner.outerWidth();

  if (want <= max + 5) {
    $scroller.hide();
    return;
  }

  $scroller.show();
  if (want == have) return;

  $inner.width(want);
  cloneScrollPos($lists, $scroller);
}

function cloneScrollPos($src, $dst) {
  var src = $src[0];
  var dst = $dst[0];

  if (src._busyScrolling) {
    src._busyScrolling--;
    return;
  }

  dst._busyScrolling++;
  dst.scrollLeft = src.scrollLeft;
}

function setupListScrolling() {
  var $lists = $(".board .lists");
  var $scroller = $(".board .lists-scroller");

  adjustListScroller();

  $lists[0]._busyScrolling = 0;
  $scroller[0]._busyScrolling = 0;

  $scroller.on("scroll", function () {
    cloneScrollPos($scroller, $lists);
  });
  $lists.on("scroll", function () {
    cloneScrollPos($lists, $scroller);
  });

  adjustLayout();
}

/*
 *	dragsters
 */
function initDragAndDrop() {
  NB.noteDrag = new Drag2();
  NB.noteDrag.listSel = ".board .list .notes";
  NB.noteDrag.itemSel = ".note";
  NB.noteDrag.dragster = "note-dragster";
  NB.noteDrag.onDragging = function (started) {
    var drag = this;
    var $note = $(drag.item);

    if (started) {
      var $drag = drag.$drag;

      if ($note.hasClass("collapsed")) $drag.addClass("collapsed");

      $drag.html("<div class=text></div>");
      $drag.find(".text").html($note.find(".text").html());

      drag.org_loc = noteLocation($note);
      if ($note.hasClass("collapsed")) drag.$drag.addClass("collapsed");
    } else {
      if (this.org_loc != noteLocation($note)) saveBoard();
    }
  };

  NB.loadDrag = new Drag2();
  NB.loadDrag.listSel = ".config .boards";
  NB.loadDrag.itemSel = "a.load-board";
  NB.loadDrag.dragster = "load-dragster";
  NB.loadDrag.onDragging = function (started) {
    var drag = this;

    if (started) {
      var $drag = drag.$drag;

      $(".config .teaser").css({ display: "none" });
      $(".config .bulk").css({ display: "block", opacity: 1 });
      $drag.html($(this.item).html());
    } else {
      $(".config .teaser").css({ display: "" });
      $(".config .bulk")
        .show()
        .delay(250)
        .queue(function () {
          $(this).css({ display: "", opacity: "" }).dequeue();
        });
      saveBoardOrder();
    }
  };
}

/*
 *	fonts
 */
function initFonts() {
  var toGo = 0;
  var loaded = [];
  var failed = [];

  NB.font = null; // current font

  //
  function isUsable(f) {
    return !failed.includes(f) && loaded.includes(f);
  }

  function onFontsLoaded() {
    var conf = NB.storage.getConfig();

    $(".config .switch-font").each(function () {
      if (!isUsable($(this).attr("font"))) $(this).remove();
    });

    if (conf.fontName && !isUsable(conf.fontName)) {
      NB.storage.setFontName(null);
      selectFont(null);
    }

    selectFont(conf.fontName || "barlow");

    if (conf.fontSize) setFontSize(conf.fontSize);

    if (conf.lineHeight) setLineHeight(conf.lineHeight);

    if (conf.listWidth) setListWidth(conf.listWidth);

    updateVarsAndLayout();
  }

  function onFontLoaded(f, ok) {
    var m = f.family.match(/["']?f-([^"']*)/);
    var f_name = m
      ? m[1]
      : ""; /* ios safari will set 'family' to 'weight' on failure ! */
    if (!ok) {
      console.log(`! Failed to load ${f.family} ${f.weight}`);
      failed.push(f_name);
    } else {
      loaded.push(f_name);
    }

    if (!--toGo) onFontsLoaded();
  }

  document.fonts.forEach(function (f) {
    if (f.status == "loaded") return;

    console.log(`Loading ${f.family} ${f.weight} ...`);
    toGo++;
    f.load()
      .then(function () {
        onFontLoaded(f, true);
      })
      .catch(function () {
        onFontLoaded(f, false);
      });
  });
}

function selectFont(font) {
  var $html = $("html");
  $html.removeClass("f-" + NB.font).addClass("f-" + font);
  NB.font = font;

  var $list = $(".config .switch-font");
  $list.removeClass("active");
  $list.filter('[font="' + font + '"]').addClass("active");

  updateVarsAndLayout();
}

//
function getVar(name) {
  var v = $("html").css(name);
  var m = v.match(/^\s*calc\((.*)\)$/);
  if (m) v = eval(m[1]);
  return parseFloat(v);
}

function getFontSize() {
  return getVar("--fs");
}

function getLineHeight() {
  return getVar("--lh");
}

function getListWidth() {
  return parseInt(getVar("--lw"));
}

//
function updateFontSize() {
  var val = getFontSize();
  $(".config .f-prefs .ui-fs .val").html(val.toFixed(1));
  return val;
}

function updateLineHeight() {
  var val = getLineHeight();
  $(".config .f-prefs .ui-lh .val").html(val.toFixed(1));
  return val;
}

function updateListWidth() {
  var val = getListWidth();
  $(".config .f-prefs .ui-lw .val").html(val.toFixed(0));
  return val;
}

function updateVarsAndLayout() {
  updateFontSize();
  updateLineHeight();
  updateListWidth();
  adjustLayout();
}

//
function setFontSize(fs) {
  fs = fs.clamp(9, 24);

  $("html")
    .css("--fs", fs + "")
    .addClass("fs-set");
  updateVarsAndLayout();

  if (getLineHeight() < fs) setLineHeight(fs);

  return getFontSize();
}

function setLineHeight(lh) {
  var fs = getFontSize();

  lh = parseInt(10 * lh) / 10; // trim to a single decimal digit
  lh = lh.clamp(fs, 3 * fs);

  $("html")
    .css("--lh", lh + "")
    .addClass("lh-set");
  updateVarsAndLayout();

  return getLineHeight();
}

function setListWidth(lw) {
  lw = lw.clamp(200, 400);

  $("html")
    .css("--lw", lw + "")
    .addClass("lw-set");
  updateVarsAndLayout();
  return getListWidth();
}

//
function resetFontSize() {
  $("html").css("--fs", "").removeClass("fs-set");
  updateVarsAndLayout();
  return updateFontSize();
}

function resetLineHeight() {
  $("html").css("--lh", "").removeClass("lh-set");
  updateVarsAndLayout();
  return updateLineHeight();
}

function resetListWidth() {
  $("html").css("--lw", "").removeClass("lw-set");
  updateVarsAndLayout();
  return updateListWidth();
}

//
function saveUiPrefs() {
  var $html = $("html");
  NB.storage.setFontSize($html.hasClass("fs-set") ? getFontSize() : null);
  NB.storage.setLineHeight($html.hasClass("lh-set") ? getLineHeight() : null);
  NB.storage.setListWidth($html.hasClass("lw-set") ? getListWidth() : null);
}

/*
 *	event handlers
 */
$(window).on("blur", function () {
  $("body").removeClass("reveal");
});

$(document).on("keydown", function (ev) {
  setRevealState(ev);
});

$(document).on("keyup", function (ev) {
  var raw = ev.originalEvent;

  setRevealState(ev);

  if (ev.target.nodeName == "TEXTAREA" || ev.target.nodeName == "INPUT") return;

  if (ev.ctrlKey && raw.code == "KeyZ") {
    var ok = ev.shiftKey ? redoBoard() : undoBoard();
    if (!ok) showDing();
  } else if (ev.ctrlKey && raw.code == "KeyY") {
    if (!redoBoard()) showDing();
  }
});

$(".wrap").on("click", ".board .text", function (ev) {
  if (this.was_dragged) {
    this.was_dragged = false;
    return false;
  }

  NB.noteDrag.cancelPriming();

  startEditing($(this), ev);
  return false;
});

$(".wrap").on("click", ".board .note .text a", function (ev) {
  if (!$("body").hasClass("reveal")) return true;

  ev.stopPropagation();
  return true;
});

//
$(".wrap").on("keydown", ".board .edit", function (ev) {
  var $this = $(this);
  var $note = $this.closest(".note");
  var $list = $this.closest(".list");

  var isNote = $note.length > 0;
  var isList = $list.length > 0;

  // esc
  if (ev.keyCode == 27) {
    stopEditing($this, true, false);
    return false;
  }

  // tab
  if (ev.keyCode == 9) {
    handleTab.call(this, ev);
    return false;
  }

  // done
  if (
    (ev.keyCode == 13 && ev.altKey) ||
    (ev.keyCode == 13 && ev.shiftKey && !ev.ctrlKey)
  ) {
    stopEditing($this, false, false);
    return false;
  }

  // done + (add after / add before)
  if (ev.keyCode == 13 && ev.ctrlKey) {
    stopEditing($this, false, false);

    if (isNote) {
      if (ev.shiftKey)
        // ctrl-shift-enter
        addNote($list, null, $note);
      else addNote($list, $note);
    } else if (isList) {
      $note = $list.find(".note").last();
      addNote($list, $note);
    } else {
      addList();
    }

    return false;
  }

  // done on Enter if editing board or list title
  if (ev.keyCode == 13 && !isNote) {
    stopEditing($this, false, false);
    return false;
  }

  // done + collapse
  if (isNote && ev.altKey && ev.key == "ArrowUp") {
    var $item = $this.parent();
    $item[0]._collapsed = true;
    stopEditing($this, false, false);
    return false;
  }

  // done + expand
  if (isNote && ev.altKey && ev.key == "ArrowDown") {
    var $item = $this.parent();
    $item[0]._collapsed = false;
    stopEditing($this, false, false);
    return false;
  }

  // done + toggle 'raw'
  if (isNote && ev.altKey && ev.keyCode == 82) {
    $this.parent().toggleClass("raw");
    stopEditing($this, false, false);
    return false;
  }

  // ctrl-shift-8
  if (isNote && ev.key == "*" && ev.ctrlKey) {
    var have = this.value;
    var pos = this.selectionStart;
    var want = have.substr(0, pos) + "\u2022 " + have.substr(this.selectionEnd);
    $this.val(want);
    this.selectionStart = this.selectionEnd = pos + 2;
    return false;
  }

  return true;
});

$(".wrap").on("keypress", ".board .edit", function (ev) {
  // tab
  if (ev.keyCode == 9) {
    handleTab.call(this, ev);
    return false;
  }
});

//
$(".wrap").on("blur", ".board .edit", function (ev) {
  if (document.activeElement != this) stopEditing($(this), false, true);
  else; // switch away from the browser window
});

//
$(".wrap").on("input propertychange", ".board .note .edit", function () {
  var delta = $(this).outerHeight() - $(this).height();

  $(this).height(10);

  if (this.scrollHeight > this.clientHeight)
    $(this).height(this.scrollHeight - delta);
});

//
$(".config").on("click", ".add-board", function () {
  addBoard();
  return false;
});

$(".config").on("click", ".load-board", function () {
  var board_id = parseInt($(this).attr("board_id"));

  NB.loadDrag.cancelPriming();

  if (NB.board && NB.board.id == board_id) closeBoard();
  else openBoard(board_id);

  return false;
});

$(".wrap").on("click", ".board .del-board", function () {
  deleteBoard();
  return false;
});

$(".wrap").on("click", ".board .undo-board", function () {
  undoBoard();
  return false;
});

$(".wrap").on("click", ".board .redo-board", function () {
  redoBoard();
  return false;
});

//
$(".wrap").on("click", ".board .add-list", function () {
  addList();
  return false;
});

$(".wrap").on("click", ".board .del-list", function () {
  deleteList($(this).closest(".list"));
  return false;
});

$(".wrap").on("click", ".board .mov-list-l", function () {
  moveList($(this).closest(".list"), true);
  return false;
});

$(".wrap").on("click", ".board .mov-list-r", function () {
  moveList($(this).closest(".list"), false);
  return false;
});

//
$(".wrap").on("click", ".board .add-note", function () {
  addNote($(this).closest(".list"));
  return false;
});

$(".wrap").on("click", ".board .del-note", function () {
  deleteNote($(this).closest(".note"));
  return false;
});

$(".wrap").on("click", ".board .raw-note", function () {
  $(this).closest(".note").toggleClass("raw");
  saveBoard();
  return false;
});

$(".wrap").on("click", ".board .collapse", function () {
  $(this).closest(".note").toggleClass("collapsed");
  saveBoard();
  return false;
});

//
$(".wrap").on("mousedown", ".board .note .text", function (ev) {
  NB.noteDrag.prime(this.parentNode, ev);
});

$(".config").on("mousedown", "a.load-board", function (ev) {
  if ($(".config a.load-board").length > 1) NB.loadDrag.prime(this, ev);
});

//
$(".config").on("mousedown", ".ui-fs .val", function (ev) {
  var org = getFontSize();
  NB.varAdjust.start(
    ev,
    function (delta) {
      setFontSize(org + delta / 50);
    },
    saveUiPrefs
  );
});

$(".config").on("mousedown", ".ui-lh .val", function (ev) {
  var org = getLineHeight();
  NB.varAdjust.start(
    ev,
    function (delta) {
      setLineHeight(org + delta / 50);
    },
    saveUiPrefs
  );
});

$(".config").on("mousedown", ".ui-lw .val", function (ev) {
  var org = getListWidth();
  NB.varAdjust.start(
    ev,
    function (delta) {
      setListWidth(org + delta / 5);
    },
    saveUiPrefs
  );
});

//
$(document).on("mouseup", function (ev) {
  NB.noteDrag.end();
  NB.loadDrag.end();
  NB.varAdjust.end();
});

$(document).on("mousemove", function (ev) {
  setRevealState(ev);
  NB.noteDrag.onMouseMove(ev);
  NB.loadDrag.onMouseMove(ev);
  NB.varAdjust.onMouseMove(ev);
});

//
$(".config .imp-board").on("click", function (ev) {
  $(".config .imp-board-select").click();
  return false;
});

$(".config .imp-board-select").on("change", function () {
  var files = this.files;
  var reader = new FileReader();
  reader.onload = function (ev) {
    importBoard(ev.target.result);
  };
  reader.readAsText(files[0]);
  return true;
});

$(".config .exp-board").on("click", function () {
  var pack = exportBoard();
  $(this).attr("href", pack.blob);
  $(this).attr("download", pack.file);
  return true;
});

$(".config .auto-backup").on("click", function () {
  configBackups();
});

//
$(".config .section .title").on("click", function () {
  $(this).closest(".section").toggleClass("open");
  return false;
});

$(".config").on("click", ".switch-font", function () {
  var font = $(this).attr("font");
  selectFont(font);
  NB.storage.setFontName(font);
  return false;
});

//
$(".config .f-prefs .ui-fs .less").on("click", function () {
  setFontSize(parseInt(10 * getFontSize()) / 10 - 0.5);
  saveUiPrefs();
  return false;
});

$(".config .f-prefs .ui-fs .val").on("click", function () {
  if (NB.varAdjust.used) return false;
  var fs = resetFontSize();
  if (getLineHeight() < fs) setLineHeight(fs);
  saveUiPrefs();
  return false;
});

$(".config .f-prefs .ui-fs .more").on("click", function () {
  setFontSize(parseInt(10 * getFontSize()) / 10 + 0.5);
  saveUiPrefs();
  return false;
});

//
$(".config .f-prefs .ui-lh .less").on("click", function () {
  setLineHeight(parseInt(10 * getLineHeight()) / 10 - 0.1);
  saveUiPrefs();
  return false;
});

$(".config .f-prefs .ui-lh .val").on("click", function () {
  if (NB.varAdjust.used) return false;
  var lh = resetLineHeight();
  if (lh < getFontSize()) setFontSize(lh);
  saveUiPrefs();
  return false;
});

$(".config .f-prefs .ui-lh .more").on("click", function () {
  setLineHeight(parseInt(10 * getLineHeight()) / 10 + 0.1);
  saveUiPrefs();
  return false;
});

//
$(".config .f-prefs .ui-lw .less").on("click", function () {
  setListWidth(getListWidth() - 5);
  saveUiPrefs();
  return false;
});

$(".config .f-prefs .ui-lw .val").on("click", function () {
  if (NB.varAdjust.used) return false;
  resetListWidth();
  saveUiPrefs();
  return false;
});

$(".config .f-prefs .ui-lw .more").on("click", function () {
  setListWidth(getListWidth() + 5);
  saveUiPrefs();
  return false;
});

//
$(".config .switch-theme").on("click", function () {
  var $html = $("html");
  $html.toggleClass("theme-dark");
  NB.storage.setTheme($html.hasClass("theme-dark") ? "dark" : "");
  return false;
});

//
$(".overlay").click(function (ev) {
  if (ev.originalEvent.target != this) return true;
  hideOverlay();
  return false;
});

$(window).keydown(function (ev) {
  if (haveOverlay() && ev.keyCode == 27) hideOverlay();
});

$(".view-about").click(function () {
  var $div = $("tt .about").clone();
  $div.find("div").html(`Version ${NB.codeVersion}`);
  showOverlay($div);
  return false;
});

$(".view-license").click(function () {
  var $div = $("tt .license").clone();
  $div.html(formatLicense());
  showOverlay($div);
  return false;
});

$(".view-changes").click(function () {
  if (!$(".logo").hasClass("updated")) return;
  NB.storage.setVerSeen();
  $(".logo").removeClass("updated");
});

/***/

$(window).resize(adjustLayout);

$("body").on("dragstart", function () {
  return false;
});

/*
 *	the init()
 */
var NB = {
  codeVersion: 20231105,
  blobVersion: 20190412, // board blob format in Storage
  board: null,
  storage: null,

  peek: function (name) {
    return this.storage.getConfig()[name];
  },

  poke: function (name, val) {
    var conf = this.storage.getConfig();
    conf[name] = val;
    return this.storage.saveConfig();
  },
};

NB.storage = new Storage_Local();

if (!NB.storage.open()) {
  easyMartina = true;
  throw new Error();
}

var boards = NB.storage.getBoardIndex();

boards.forEach(function (meta, board_id) {
  var hist = meta.history.join(", ");
  console.log(
    `Found board ${board_id} - "${meta.title}", revision ${
      meta.current
    }, history [${hist}], backup ${JSON.stringify(meta.backupStatus)}`
  );
});

//
var conf = NB.storage.getConfig();

console.log(`Active:    [${conf.board}]`);
console.log(`Theme:     [${conf.theme}]`);
console.log(
  `Font:      [${conf.fontName}], size [${
    conf.fontSize || "-"
  }], line-height [${conf.lineHeight || "-"}]`
);
console.log(`FileLinks: [${conf.fileLinks}]`);
console.log("Backups:   ", conf.backups);

/*
 *	backups
 */
NB.backupTypes = new Map();
NB.backupTypes.set(new SimpleBackup().type, SimpleBackup);

NB.storage.initBackups(onBackupStatusChange);

/*
 *	the ui
 */
initFonts();

initDragAndDrop();

NB.varAdjust = new VarAdjust();

//
if (conf.theme) $("html").addClass("theme-" + conf.theme);

if (conf.board) openBoard(conf.board);

adjustLayout();

updateBoardIndex();

setWhatsNew();

NB.storage.setVerLast();

//
if (!NB.board && !$(".config .load-board").length) NB.board = createDemoBoard();

if (NB.board) showBoard(true);

//
setInterval(adjustListScroller, 100);

setupListScrolling();
