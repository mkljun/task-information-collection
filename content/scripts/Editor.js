var oDoc, sDefTxt;
 
function initDoc(elementID) {
  oDoc = document.getElementById(elementID);
  sDefTxt = oDoc.innerHTML;
}
 
function formatDoc(sCmd, sValue) {
  if (validateMode()) { document.execCommand(sCmd, false, sValue); oDoc.focus(); }
}

function validateMode() {
  return true;
}
 
