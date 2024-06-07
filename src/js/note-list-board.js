function Note(text) {
  this.text = text;
  this.raw = false;
  this.min = false;
}

function List(title) {
  this.title = title;
  this.notes = [];

  this.addNote = function (text) {
    var x = new Note(text);
    this.notes.push(x);
    return x;
  };
}

function Board(title) {
  this.format = NB.blobVersion;
  this.id = +new Date();
  this.revision = 0;
  this.title = title || "";
  this.lists = [];

  this.addList = function (title) {
    var x = new List(title);
    this.lists.push(x);
    return x;
  };
}
