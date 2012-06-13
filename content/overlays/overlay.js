/* This script is taken from SQLite manager ans is a bit modified tu suit our purposes */

//the advice given at http://blogger.ziesemer.com/2007/10/respecting-javascript-global-namespace.html has been followed
if(!org) var org={};
if(!org.menola) org.menola={};

// The only global object here.
org.menola.tic = function() {

  //public object returned by this function
  var pub = {};

  pub.smChrome = "chrome://tic/content/index.html";

  pub.open = function() {
    var iOpenMode = 2;
    try {
      var prefService = Components.classes["@mozilla.org/preferences-service;1"].getService(Components.interfaces.nsIPrefService).getBranch("extensions.tic.");
      iOpenMode = prefService.getIntPref("openMode");
    }
    catch(e) {
    }

    switch (iOpenMode) {
      case 1:      //open a chrome window
        this.openInOwnWindow();
        break;
      case 2:      //open in a new tab
        openUILinkIn(this.smChrome,"tab");
        break;
    }
  };

  //Sb & Tb
  pub.openInOwnWindow = function() {
    window.open(this.smChrome, "", "resizable,centerscreen");//,width=800,height=600");
    //EXAMPLES
    //var w = window.open("chrome://myplugin/content/search.html","My Plugin");
    //window.open("chrome://helloworld/content/hello.xul", "", "chrome");
    // window.open("http://www.domainname.ext/path/ImgFile.png",  
    //    "DescriptiveWindowName",  
    //    "width=420,height=230,resizable,scrollbars=yes,status=1");  
    // } 
    return;
  };

  return pub;
}();


/**
* Appends TIC start button into Firefox toolbar automatically after installation.
* The button is appended only once so, if the user removes it, it isn't appended again.
*/
window.addEventListener("load", function appendToToolbar() {
  //get the TIC preferences - firstRunButtons is set to false before installing
  var prefs = Components.classes["@mozilla.org/preferences-service;1"]
                        .getService(Components.interfaces.nsIPrefService);
  var branch = prefs.getBranch("extensions.tic.");
  //for testing purposes
  //branch.setBoolPref("firstRunButtons", false); 
  
  var firstRunButtons = branch.getBoolPref("firstRunButtons");
  //var firstRunButtons2 = branch.getChildList("",{});
  //var firstRunButtons3 = branch.getPrefType("firstRunButtons");
  //Components.utils.reportError(firstRunButtons+"-::-"+firstRunButtons2+"-::-"+firstRunButtons3+"-::-");

  if (firstRunButtons==false) { 
      //set the preference to true after the first visit
      branch.setBoolPref("firstRunButtons", true);
      firstRunButtons = branch.getBoolPref("firstRunButtons");
      //Components.utils.reportError(firstRunButtons+"-::-");
      try {
        var startButtonId = "tic-button";
        var navBarId = "nav-bar";
        var navBar = top.document.getElementById(navBarId);
        var currentSet = navBar.currentSet;
        navBar.insertItem(startButtonId);
        navBar.setAttribute("currentset", navBar.currentSet);
        navBar.ownerDocument.persist("nav-bar", "currentset");
      } catch(e) { 

      }
  }
}, false);






