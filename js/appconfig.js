function AppConfig() {
  this.verLast = null; // last used codeVersion
  this.verSeen = null; // latest codeVersion they saw the changelog for

  this.maxUndo = 50; // board revisions to keep
  this.fontName = null; // font-family
  this.fontSize = null; // font-size
  this.lineHeight = null; // line-height
  this.listWidth = null; // list-width
  this.theme = null; // default or 'dark'

  this.fileLinks = false; // mark up `foo` as <a href=file:///foo>...</a>

  this.board = null; // active board

  this.backups = {
    agents: [], // [ { type, id, enabled, conf } ];
    nextId: 1,
  };

  this.backupStatus = {}; // agentId => [ 'conf' ]
}

const default_backup_agents = [
  { base: "http://127.0.0.1:10001", auth: "" }, // local agent
  { base: "", auth: "" }, // remote agent
];

//

function BoardMeta() {
  this.title = "";
  this.current = 1; // revision
  this.ui_spot = 0; // 0 = not set
  this.history = []; // revision IDs
  this.backupStatus = {}; // agentId => [ what's backed up ]
}

class Storage {
  constructor() {
    this.type = "?";

    this.conf = new AppConfig();
    this.boardIndex = new Map();

    this.backups = {
      status: "", // '', 'ok', 'busy', 'failed'
      agents: [], // BackupStorage instances
    };
  }

  open() {
    return this.openInner();
  }

  wipe() {
    return this.wipeInner();
  }

  getConfig() {
    return this.conf;
  }

  setVerLast() {
    if (this.conf.verLast == NB.codeVersion) return true;

    this.conf.verLast = NB.codeVersion;
    return this.saveConfig();
  }

  setVerSeen(ver) {
    this.conf.verSeen = ver || NB.codeVersion;
    return this.saveConfig();
  }

  setActiveBoard(board_id) {
    console.log(
      "setActiveBoard [" + this.conf.board + "] -> [" + board_id + "]"
    );

    var meta = board_id ? this.boardIndex.get(board_id) : true;

    if (!meta) throw `Invalid board_id in setActiveBoard(... ${board_id})`;

    if (this.conf.board == board_id) return true;

    this.conf.board = board_id;
    return this.saveConfig();
  }

  setTheme(theme) {
    if (this.conf.theme == theme) return;
    this.conf.theme = theme;
    return this.saveConfig();
  }

  setFontName(fname) {
    if (this.conf.fontName == fname) return;
    this.conf.fontName = fname;
    return this.saveConfig();
  }

  setFontSize(fs) {
    if (this.conf.fontSize == fs) return;
    this.conf.fontSize = fs;
    return this.saveConfig();
  }

  setLineHeight(lh) {
    if (this.conf.lineHeight == lh) return;
    this.conf.lineHeight = lh;
    return this.saveConfig();
  }

  setListWidth(lw) {
    if (this.conf.listWidth == lw) return;
    this.conf.listWidth = lw;
    return this.saveConfig();
  }

  saveConfig() {
    this.backupConfig();
    return this.setJson("config", this.conf);
  }

  //

  getBoardIndex() {
    return this.boardIndex;
  }

  saveBoard(board) {
    /*
     *	1. assign new revision (next unused)
     *	2. trim all in-between revisions bypassed by undos if any
     *	3. cap history as per config
     */
    var meta = this.boardIndex.get(board.id);
    var ok_data, ok_meta;

    delete board.history; // remove temporarily

    if (!meta) {
      board.revision = 1;

      ok_data = this.setJson("board." + board.id + "." + board.revision, board);

      meta = new BoardMeta();
      meta.title = board.title || "(Untitled board)";
      meta.current = board.revision;
      meta.history = [board.revision];

      this.boardIndex.set(board.id, meta);
    } else {
      var rev_old = board.revision;
      var rev_new = meta.history[0] + 1;

      board.revision = rev_new;

      ok_data = this.setJson("board." + board.id + "." + board.revision, board);

      meta.title = board.title || "(Untitled board)";
      meta.current = board.revision;

      // trim revisions skipped over with undo and cap the revision count

      var rebuild = [board.revision];

      for (var rev of meta.history) {
        if (
          (rev_old < rev && rev < rev_new) ||
          rebuild.length >= this.conf.maxUndo
        ) {
          this.delItem("board." + board.id + "." + rev);
          console.log(
            `Deleted revision ${rev} of ${board.id} (${board.title})`
          );
        } else {
          rebuild.push(rev);
        }
      }

      meta.history = rebuild;
    }

    /*
     *	save meta
     */
    ok_meta =
      this.setJson("board." + board.id + ".meta", meta) &&
      this.setJson("board." + board.id, meta.current); // for older versions

    /*
     *	run backups
     */
    if (ok_meta && ok_data) this.backupBoard(board.id, board, meta);

    board.history = meta.history; // restore

    console.log(
      `Saved revision ${board.revision} of ${board.id} (${board.title}), ok = ${ok_data} | ${ok_meta}`
    );
    return ok_data && ok_meta;
  }

  loadBoard(board_id, revision) {
    var meta = this.boardIndex.get(board_id);

    if (!meta) throw `Invalid board_id in loadBoard(${board_id}, ${revision})`;

    if (revision == null) revision = meta.current;

    if (!meta.history.includes(revision))
      throw `Invalid revision in loadBoard(${board_id}, ${revision})`;

    var board = this.getJson("board." + board_id + "." + revision);
    if (!board) return false;

    if (board.format != NB.blobVersion) {
      console.log(
        "Board " + board_id + "/" + revision + " format is unsupported"
      );
      console.log("Have [" + board.format + "], need [" + NB.blobVersion);
      return false;
    }

    if (board.revision != revision) {
      console.log("Board " + board_id + "/" + revision + " revision is wrong");
      console.log("Have [" + board.revision + "]");
      return false;
    }

    board.history = meta.history;

    console.log(
      `Loaded revision ${board.revision} of ${board.id} (${board.title})`
    );

    return Object.assign(new Board(), board);
  }

  nukeBoard(board_id) {
    var meta = this.boardIndex.get(board_id);

    if (!meta) throw `Invalid board_id in nukeBoard(${board_id})`;

    var title = meta.title + "";

    for (var rev of meta.history) this.delItem("board." + board_id + "." + rev);

    this.delItem("board." + board_id + ".meta");
    this.boardIndex.delete(board_id);

    this.backups.agents.forEach(function (store) {
      store.nukeBoard(board_id);
    });

    console.log(`Deleted board ${board_id} (${title})`);
  }

  getBoardHistory(board_id) {
    var meta = this.boardIndex.get(board_id);

    if (!meta) throw `Invalid board_id in getBoardHistory(${board_id})`;

    return meta.history;
  }

  setBoardRevision(board_id, revision) {
    var meta = this.boardIndex.get(board_id);

    if (!meta)
      throw `Invalid board_id in setBoardRevision(${board_id}, ${revision})`;

    if (!meta.history.includes(revision))
      throw `Invalid revision in setBoardRevision(${board_id}, ${revision})`;

    if (meta.current == revision)
      // wth
      return true;

    meta.current = revision;

    this.backupBoard(board_id, null, meta);

    return (
      this.setJson("board." + board_id + ".meta", meta) &&
      this.setJson("board." + board_id, revision)
    ); // for older versions
  }

  setBoardUiSpot(board_id, ui_spot) {
    var meta = this.boardIndex.get(board_id);

    if (!meta)
      throw `Invalid board_id in setBoardUiSpot(${board_id}, ${ui_spot})`;

    meta.ui_spot = ui_spot;

    this.backupBoard(board_id, null, meta);

    return this.setJson("board." + board_id + ".meta", meta);
  }

  /*
   *	private
   */

  getItem(name) {
    throw "implement-me";
  }
  setItem(name) {
    throw "implement-me";
  }
  delItem(name) {
    throw "implement-me";
  }

  openInner() {
    throw "implement-me";
  }
  wipeInner() {
    throw "implement-me";
  }

  getJson(name) {
    var foo = this.getItem(name);
    if (!foo) return false;

    try {
      foo = JSON.parse(foo);
    } catch (x) {
      return false;
    }
    return foo;
  }

  setJson(name, val) {
    if (!this.setItem(name, JSON.stringify(val))) {
      console.log("setJson(" + name + ") failed");
      return false;
    }

    return true;
  }

  /*
   *	config
   */
  fixupConfig(newInstall) {
    var conf = this.conf;
    var simp = new SimpleBackup().type;

    if (conf.board && !this.boardIndex.has(conf.board)) conf.board = null;

    if (!conf && !newInstall) {
      // pre-20210410 upgrade
      conf.verLast = 20210327;
      conf.verSeen = 20200220; // 20200429;
    }

    var agents = conf.backups.agents;

    if (
      agents.length != 2 ||
      agents[0].type != simp ||
      agents[0].conf.base != "http://127.0.0.1:10001" ||
      agents[1].type != simp
    ) {
      const def = default_backup_agents;

      console.log("Unexpected backup config, will re-initialize.", agents);

      conf.backups.agents = [];

      conf.backups.agents.push({
        // localhost
        type: simp,
        id: simp + "-" + conf.backups.nextId++,
        enabled: def[0].base && def[0].auth,
        conf: def[0],
      });

      conf.backups.agents.push({
        // remote
        type: simp,
        id: simp + "-" + conf.backups.nextId++,
        enabled: def[1].base && def[1].auth,
        conf: def[1],
      });

      this.saveConfig();
    }
  }

  /*
   *	backups
   */
  initBackups(onBackupStatus) {
    var self = this;
    var pending = 0;
    var success = true;
    var store_id = 1;

    self.backups.agents = [];

    onBackupStatus(null);

    this.conf.backups.agents.forEach(function (b) {
      var T = NB.backupTypes.get(b.type);
      if (!T) {
        console.log(`Unknown backup type "${b.type}" - skipped`);
        return;
      }

      if (!b.enabled) return;

      var agent = new T(b.id, b.conf, onBackupStatus);
      self.backups.agents.push(agent);

      console.log(
        `Added backup agent - type '${agent.type}', id '${agent.id}'`
      );

      agent.checkStatus(null); // will need just onBackupStatus() callbacks
    });
  }

  backupBoard(board_id, board, meta) {
    var self = this;
    var was = meta.backupStatus || {};

    meta.backupStatus = {};

    if (!this.backups.agents.length) {
      if (was["data"] || was["meta"])
        self.setJson("board." + board_id + ".meta", meta);
      return;
    }

    console.log(`Backing up ${board_id}...`);

    this.backups.agents.forEach(function (agent) {
      var fields = was[agent.id] || {};

      if (board) delete fields.data;
      if (meta) delete fields.meta;

      meta.backupStatus[agent.id] = fields;

      agent.saveBoard(board_id, board, meta, function (ok) {
        var what = "Backup of " + board_id + (board ? "" : " (meta)");
        console.log(`${what} to '${agent.id}' -> ${ok ? "ok" : "failed"}`);

        if (ok) {
          if (board) fields.data = +new Date();
          if (meta) fields.meta = +new Date();

          meta.backupStatus[agent.id] = fields;
        }

        self.setJson("board." + board_id + ".meta", meta);
      });
    });
  }

  backupConfig() {
    var self = this;
    var was = self.conf.backupStatus || {};

    self.conf.backupStatus = {};

    if (!this.backups.agents.length) {
      if (was["conf"]) this.setJson("config", this.conf);
      return;
    }

    this.backups.agents.forEach(function (agent) {
      var fields = {};

      self.conf.backupStatus[agent.id] = fields;

      agent.saveConfig(self.conf, function (ok) {
        if (ok) {
          fields.conf = +new Date();
          self.conf.backupStatus[agent.id] = fields;
        }

        self.setJson("config", self.conf);
      });
    });
  }
}

class Storage_Local extends Storage {
  constructor() {
    super();
    this.type = "LocalStorage";
  }

  getItem(name) {
    return localStorage.getItem("nullboard." + name);
  }

  setItem(name, val) {
    localStorage.setItem("nullboard." + name, val);
    return true;
  }

  delItem(name) {
    localStorage.removeItem("nullboard." + name);
    return true;
  }

  openInner() {
    var conf = this.getJson("config");
    var newInstall = true;

    //			if (conf && (conf.format != NB.confVersion))
    //			{
    //				if (! confirm('Preferences are stored in an unsupported format. Reset them?'))
    //					return false;
    //
    //				conf = null;
    //			}

    if (conf) {
      this.conf = Object.assign(new AppConfig(), conf);
    } else {
      this.conf.theme = this.getItem("theme");

      if (this.getItem("fsize") == "z1") {
        this.conf.fontSize = 13;
        this.conf.lineHeight = 17;
      }

      if (!this.setJson("config", this.conf)) {
        this.conf = null;
        return false;
      }

      this.conf.board = this.getItem("last_board");
    }

    this.boardIndex = new Map();

    // new format

    for (var i = 0; i < localStorage.length; i++) {
      var k = localStorage.key(i);
      var m = k.match(/^nullboard\.board\.(\d+).meta$/);

      if (!m) continue;

      var board_id = parseInt(m[1]);
      var meta = this.getJson("board." + board_id + ".meta");

      if (!meta.hasOwnProperty("history")) {
        console.log(`Invalid meta for board ${board_id}`);
        continue;
      }

      for (var rev of meta.history)
        if (!this.getJson("board." + board_id + "." + rev)) {
          console.log(`Invalid revision ${rev} in history of ${board_id}`);
          meta = this.rebuildMeta(board_id);
          break;
        }

      if (!meta) continue;

      delete meta.backingUp; // run-time var
      delete meta.needsBackup; // ditto

      meta = Object.assign(new BoardMeta(), meta);
      this.boardIndex.set(board_id, meta);
    }

    // old format

    for (var i = 0; i < localStorage.length; i++) {
      var k = localStorage.key(i);
      var m = k.match(/^nullboard\.board\.(\d+)$/);

      if (!m) continue;

      newInstall = false;

      var board_id = parseInt(m[1]);
      if (this.boardIndex.has(board_id)) continue;

      var meta = this.rebuildMeta(board_id);
      if (!meta) continue;

      meta = Object.assign(new BoardMeta(), meta);
      this.boardIndex.set(board_id, meta);
    }

    this.fixupConfig(newInstall);

    this.type = "LocalStorage";

    return true;
  }

  wipeInner() {
    for (var i = 0; i < localStorage.length; ) {
      var k = localStorage.key(i);
      var m = k.match(/^nullboard\./);

      if (m) localStorage.removeItem(k);
      else i++;
    }

    this.conf = new AppConfig();
    this.boardIndex = new Map();
  }

  /*
   *	private
   */
  rebuildMeta(board_id) {
    var meta = new BoardMeta();

    console.log(`Rebuilding meta for ${board_id} ...`);

    // get current revision

    meta.current = this.getItem("board." + board_id); // may be null

    // load history

    var re = new RegExp("^nullboard.board." + board_id + ".(\\d+)$");
    var revs = new Array();

    for (var i = 0; i < localStorage.length; i++) {
      var m = localStorage.key(i).match(re);
      if (m) revs.push(parseInt(m[1]));
    }

    if (!revs.length) {
      console.log("* No revisions found");
      this.delItem("board." + board_id);
      return false;
    }

    revs.sort(function (a, b) {
      return b - a;
    });
    meta.history = revs;

    // validate current revision

    if (!meta.history.includes(meta.current))
      meta.current = meta.history[meta.history.length - 1];

    // get board title

    var board = this.getJson("board." + board_id + "." + meta.current);
    meta.title = board.title || "(untitled board)";

    this.setJson("board." + board_id + ".meta", meta);

    return meta;
  }
}

/*
 *
 */
class BackupStorage {
  constructor(id, conf, onStatusChange) {
    this.type = "?";

    this.id = id;
    this.conf = conf;
    this.status = "";
    this.lastOp = "";
    this.lastXhr = { op: "", text: "", code: 0 };
    this.onStatusChange = onStatusChange;
    this.queue = [];
  }

  checkStatus(cb) {
    return false;
  }
  saveConfig(conf, cb) {
    throw "implement-me";
  }
  saveBoard(id, data, meta, cb) {
    throw "implement-me";
  }
  nukeBoard(id, cb) {
    throw "implement-me";
  }
}

class SimpleBackup extends BackupStorage {
  constructor(id, conf, onStatusChange) {
    super(id, null, onStatusChange);

    this.type = "simp";
    this.conf = { base: "", auth: "" };
    this.conf = Object.assign(this.conf, conf);
  }

  checkStatus(cb) {
    this.queue.push({
      what: "checkStatus",
      cb: cb,
      args: {
        url: this.conf.base + "/config",
        type: "put",
        headers: { "X-Access-Token": this.conf.auth },
        data: {
          self: document.location.href,
          //	conf: -- without the data --
        },
        dataType: "json",
      },
    });

    this.runQueue();
  }

  saveConfig(conf, cb) {
    this.queue.push({
      what: "saveConfig",
      cb: cb,
      args: {
        url: this.conf.base + "/config",
        type: "put",
        headers: { "X-Access-Token": this.conf.auth },
        data: {
          self: document.location.href,
          conf: JSON.stringify(conf),
        },
        dataType: "json",
      },
    });

    this.runQueue();
  }

  saveBoard(id, data, meta, cb) {
    this.queue.push({
      what: "saveBoard",
      cb: cb,
      args: {
        url: this.conf.base + "/board/" + id,
        type: "put",
        headers: { "X-Access-Token": this.conf.auth },
        data: {
          self: document.location.href,
          data: data ? JSON.stringify(data) : null,
          meta: meta ? JSON.stringify(meta) : null,
        },
        dataType: "json",
      },
    });

    this.runQueue();
  }

  nukeBoard(id, cb) {
    this.queue.push({
      what: "saveBoard",
      cb: cb,
      args: {
        url: this.conf.base + "/board/" + id,
        type: "delete",
        headers: { "X-Access-Token": this.conf.auth },
      },
    });

    this.runQueue();
  }

  /*
   *	private
   */
  runQueue() {
    var self = this;

    if (!this.queue.length) return;

    if (this.status == "busy") return;

    var req = this.queue.shift();

    this.setStatus("busy", req.what);

    $.ajax(req.args)
      .done(function (d, s, x) {
        self.onRequestDone(req, true, x);
      })
      .fail(function (x, s, e) {
        self.onRequestDone(req, false, x);
      });
  }

  onRequestDone(req, ok, xhr) {
    console.log(
      `Backup agent '${this.id}', ${this.lastOp}() -> ${ok ? "ok" : "failed"}`
    );

    var code = xhr.status;
    var text =
      xhr.responseText ||
      (code ? `Response code ${code}` : "Offline or CORS-blocked");

    this.lastXhr = { text: text, code: code };

    if (req.cb) req.cb.call(this, ok);

    if (!this.queue.length) {
      this.setStatus(ok ? "ready" : "error", this.lastOp);
      return;
    }

    this.status = "pre-busy";
    this.runQueue();
  }

  setStatus(status, op) {
    if (status == "busy" && this.status == "busy")
      throw `Backup agent ${this.id} is already busy!`;

    console.log(
      `Backup agent '${this.id}' status: '${this.status}' -> '${status}'`
    );

    this.status = status;
    this.lastOp = op;
    this.onStatusChange(this);
  }
}
