Number.prototype.clamp = function (min, max) {
  return Math.min(Math.max(this, min), max);
};

/*
 *	add a blank line to push 'Prevent this page from opening ...'
 *	tack-on from the actual message we are trying to display
 */
var confirm_org = window.confirm;
var alert_org = window.alert;
window.confirm = function (msg) {
  return confirm_org(msg + "\n ");
};
window.alert = function (msg) {
  return alert_org(msg + "\n ");
};
