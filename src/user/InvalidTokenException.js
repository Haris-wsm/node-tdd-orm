module.exports = function InavalidTokenException() {
  this.message = 'account_activation_failure';
  this.status = 400;
};
