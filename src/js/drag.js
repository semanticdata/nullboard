function Drag2() {
  // config
  this.listSel = null;
  this.itemSel = null;
  this.dragster = null;
  this.onDragging = function (started) {};
  this.swapAnimMs = 200;

  // state
  this.item = null;
  this.priming = null;
  this.primeXY = { x: 0, y: 0 };
  this.$drag = null;
  this.mouseEv = null;
  this.delta = { x: 0, y: 0 };
  this.inSwap = 0;

  // api
  this.prime = function (item, ev) {
    var self = this;

    this.item = item;
    this.priming = setTimeout(
      function () {
        self.onPrimed.call(self);
      },
      ev.altKey ? 1 : 500
    );
    this.primeXY = { x: ev.clientX, y: ev.clientY };
    this.mouseEv = ev;
  };

  this.cancelPriming = function () {
    if (!this.item || !this.priming) return;

    clearTimeout(this.priming);
    this.priming = null;
    this.item = null;
  };

  this.end = function () {
    this.cancelPriming();
    this.stopDragging();
  };

  this.isActive = function () {
    return this.item && this.priming == null;
  };

  this.onPrimed = function () {
    clearTimeout(this.priming);
    this.priming = null;

    removeTextSelection();

    var $item = $(this.item);
    $item.addClass("dragging");

    $("body").append("<div class=" + this.dragster + "></div>");
    var $drag = $("body ." + this.dragster).last();

    $drag.outerWidth($item.outerWidth());
    $drag.outerHeight($item.outerHeight());

    this.$drag = $drag;

    if (this.onDragging) this.onDragging.call(this, true); // started

    var $win = $(window);
    var scroll_x = $win.scrollLeft();
    var scroll_y = $win.scrollTop();

    var pos = $item.offset();
    this.delta.x = pos.left - this.mouseEv.clientX - scroll_x;
    this.delta.y = pos.top - this.mouseEv.clientY - scroll_y;

    this.adjustDrag();

    $drag.css({ opacity: 1 });

    $("body").addClass("dragging");
  };

  this.adjustDrag = function () {
    if (!this.$drag) return;

    var drag = this;
    var $drag = this.$drag;

    var $win = $(window);
    var scroll_x = $win.scrollLeft();
    var scroll_y = $win.scrollTop();

    var drag_x = drag.mouseEv.clientX + drag.delta.x + scroll_x;
    var drag_y = drag.mouseEv.clientY + drag.delta.y + scroll_y;

    $drag.offset({ left: drag_x, top: drag_y });

    if (drag.inSwap) return;

    /*
     *	see if a swap is in order
     */
    var pos = $drag.offset();
    var x = pos.left + $drag.width() / 2 - $win.scrollLeft();
    var y = pos.top + $drag.height() / 2 - $win.scrollTop();

    var targetList = null;
    var targetItem = null; // if over some item
    var before = false; // if should go before targetItem

    var $target;

    $(this.listSel).each(function () {
      var list = this;
      var rcList = list.getBoundingClientRect();
      var yTop,
        itemTop = null;
      var yBottom,
        itemBottom = null;

      if (x <= rcList.left || rcList.right <= x) return;

      $(list)
        .find(drag.itemSel)
        .each(function () {
          var rcItem = this.getBoundingClientRect();

          if (!itemTop || rcItem.top < yTop) {
            itemTop = this;
            yTop = rcItem.top;
          }

          if (!itemBottom || yBottom < rcItem.bottom) {
            itemBottom = this;
            yBottom = rcItem.bottom;
          }

          if (y <= rcItem.top || rcItem.bottom <= y) return;

          if (this == drag.item) return;

          targetList = list;
          targetItem = this;
          before = y < (rcItem.top + rcItem.bottom) / 2;
        });

      if (y < rcList.top) {
        targetList = list;
        targetItem = itemTop;
        before = true;
      } else if (y >= rcList.bottom) {
        targetList = list;
        targetItem = itemBottom;
        before = false;
      }
    });

    if (!targetList) return;

    if (targetItem) {
      if (targetItem == drag.item) return;

      $target = $(targetItem);

      if (
        (!before && $target.next()[0] == drag.item) ||
        (before && $target.prev()[0] == drag.item)
      )
        return;
    }

    /*
     *	swap 'em
     */
    var have = drag.item;
    var $have = $(have);
    var $want = $have.clone();

    $want.css({ display: "none" });

    if (targetItem) {
      if (before) {
        $want.insertBefore($target);
        $want = $target.prev();
      } else {
        $want.insertAfter($target);
        $want = $target.next();
      }
    } else {
      var $list = $(targetList);
      $want = $list.append($want).find(drag.itemSel);
    }

    drag.item = $want[0];

    if (!drag.swapAnimMs) {
      $have.remove();
      $want.show();
      return;
    }

    /*
     *	see if it's a same-list move
     */
    if (targetList == have.parentNode) {
      var delta = $have.offset().top - $target.offset().top;

      var d_bulk = 0;
      var d_have = 0;
      var $bulk = $();

      if (delta < 0) {
        // item is moving down
        for (
          var $i = $have.next();
          $i.length && $i[0] != $want[0];
          $i = $i.next()
        )
          $bulk = $bulk.add($i);
      } else {
        for (
          var $i = $want.next();
          $i.length && $i[0] != $have[0];
          $i = $i.next()
        )
          $bulk = $bulk.add($i);
      }

      d_bulk = $have.outerHeight(true);
      d_have =
        $bulk.last().offset().top +
        $bulk.last().outerHeight(true) -
        $bulk.first().offset().top;

      if (delta < 0) d_bulk = -d_bulk;
      else d_have = -d_have;

      $have.parent().css({ position: "relative" });
      $have.css({ position: "relative", "z-index": 0 });
      $bulk.css({ position: "relative", "z-index": 1 });

      drag.inSwap = 1 + $bulk.length;

      $have.animate({ top: d_have }, drag.swapAnimMs, function () {
        if (!--drag.inSwap) swapCleanUp();
      });
      $bulk.animate({ top: d_bulk }, drag.swapAnimMs, function () {
        if (!--drag.inSwap) swapCleanUp();
      });

      function swapCleanUp() {
        $have.parent().css({ position: "" });

        $have.remove();
        $want.show();
        $bulk.css({ position: "", "z-index": "", top: "" });

        drag.adjustDrag();
      }
    } else {
      drag.inSwap = 1;

      $want.slideDown(drag.swapAnimMs);

      $have.slideUp(drag.swapAnimMs, function () {
        $have.remove();
        drag.inSwap = 0;
        drag.adjustDrag();
      });
    }
  };

  this.onMouseMove = function (ev) {
    this.mouseEv = ev;

    if (!this.item) return;

    if (this.priming) {
      var x = ev.clientX - this.primeXY.x;
      var y = ev.clientY - this.primeXY.y;
      if (x * x + y * y > 5 * 5) this.onPrimed();
    } else {
      this.adjustDrag();
    }
  };

  this.stopDragging = function () {
    var $item = $(this.item);

    $item.removeClass("dragging");
    $("body").removeClass("dragging");

    if (this.$drag) {
      this.$drag.remove();
      this.$drag = null;

      removeTextSelection();

      if (this.onDragging) this.onDragging.call(this, false); // stopped
    }

    this.item = null;
  };
}
