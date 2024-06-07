function VarAdjust() {
  // state
  this.onChange = null;
  this.onFinish = null;
  this.startY = 0;
  this.used = false;

  // api
  this.start = function (ev, onChange, onFinish) {
    if (!onChange) return;

    this.onChange = onChange;
    this.onFinish = onFinish;
    this.startY = ev.clientY;
    this.used = false;

    var self = this;
    setTimeout(function () {
      if (!self.onChange) return;
      $("body").addClass("adjusting");
      self.used = true;
    }, 250);
  };

  this.onMouseMove = function (ev) {
    if (!this.onChange) return;

    $("body").addClass("adjusting");
    self.used = true;
    this.onChange(ev.clientY - this.startY);
  };

  this.end = function () {
    if (!this.onChange) return;

    $("body").removeClass("adjusting");
    this.onChange = null;

    if (this.onFinish) this.onFinish();
  };
}
