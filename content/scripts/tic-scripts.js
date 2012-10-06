/***************************************************************************
* 
* Task Information Collection
* 
* MIT licence
* by Matjaž Kljun
*
****************************************************************************/

/***************************************************************************
* 
* Global variables
*
****************************************************************************/
var data;             //stores a TIC of the currently selected task
var currentTaskId;    //id of the currently selected task/project
var currentTaskName;  //name of the currently selected task/project
var connection;		  //a handle to the database connection
//currently not using mootools slider - it's slow, it draws additional TIC before the last one
//var mySlide; 
var pastTICStatesIds; //array of old ids used for timeline 
var pastTICStatesCurrentIndex; //id of currently viewed old state in a timeline
var pastTICStatesInterval; //interval for each state to be visible in a playback
var tempURIforXUL;    //for opening a preview of an URL in a XUL iframe for security purposes
//version ... for updating DB

/***************************************************************************
Functions strated and events added to DOM elements when the page loads up
The function is called: after DOM loads
****************************************************************************/
window.addEvent('domready', function() { //adding different events to DOM elements
	//create empty object
	data = {};
	//create DB handle
	connection = databaseConnect();
	//get the last selected task from the DB
	currentTaskId = databaseGetLastTask();
	//print out all tasks in the left panel
	databaseShowTasks();	
	databaseShowArchivedTasks();	
	//get and draw data from the last selected task
	databaseDrawTaskCollection(currentTaskId);
	//draw home, desktop and note icons
	drawGeneralIcons();

	//save state of the task and close DB connection if a page is being closed
	window.onunload = function(e) {
		databaseSaveTaskCollection(databaseDrawTaskCollection, "0");
		//databaseSetLastTask();
		connection.asyncClose();
	}

	//if the windowresizes, re-position all the elements relative to the window size
	window.onresize = function(e) {
		drawTICElements();
		drawPICCircles();
	}
});

//save the state of a task every X mili seconds - 3000000 ms is 5 minutes
(function() { databaseSaveTaskCollection(databaseDrawTaskCollection, currentTaskId) }).periodical(300000);
//set the last task to the currently selected
(function() { databaseSetLastTask() }).periodical(180000);
//try to send the dump of the database every hour ... at sends it every 7 days based on the date in DB
(function() { databaseDump() }).periodical(3600000);
//run maintenance like Reindex and Vacuum once a month based on the date in DB
(function() { databaseMaintenance() }).periodical(3600000);

/***************************************************************************
Function to draw elements of the selected project/task on the page.
The functions are called:
drawTICElements() function draws elements of a selected task on the page
	The function iterates trought object data.
	- databaseDrawTaskCollection(taskid): when a new task is selected
	- doDrop(event): when new items are dropped, saved in global data variable
  	  and drawn back on the page
  	- window.onresize: when a browser window is resized
  	- databaseSaveEditTaskName(newName, taskid): when a task name is changed 
  	  and saved
drawTICElementsPastStates(pastStatesId): draws past task states without 
posibility to change things
	- playDrawTICElementsPastStates(): when the playback of old states is selected
playDrawTICElementsPastStates(): calls the drawing if an old state based on 
pastTICStatesCurrentIndex
    - databaseDrawTaskCollection(taskid) appended to the show next button on the timelene
      and to the past states of the task on the mase timeline
startDrawTICElementsPastStates() : starts the timeline playback
	- databaseDrawTaskCollection(taskid) appended to the play button
stopDrawTICElementsPastStates(pastStatesId): stops the timeleni playback
	- databaseDrawTaskCollection(taskid): appended to the stop and playnext button
****************************************************************************/
function drawTICElements() {
	var coordinatex = "";
	var icon = "";
	var name = "";
	//empty the div with all items before starting puting items of a new task in
	$("itemsList").empty();
	//print a task name in the centre (see also printTaskNameCentre and databaseGetTaskName)
	//needed in case someone comes from old states where the name includes date.
	$("tasknametext").set('html', currentTaskName);
	// draw all elements from the data object
	Object.each (data, function(value, key){

		//find item type and icon
		var fileExt = value["name"].split(".").getLast(); //get the last dot & take what's after it
		if ((value["type"] == "FILE")) {
			if (fileExt.toLowerCase() == "exe") {
				//icon of EXE file - program or software  
				var ios = Components.classes["@mozilla.org/network/io-service;1"].
				  getService(Components.interfaces.nsIIOService);
				var fph = ios.getProtocolHandler("file").
				  QueryInterface(Components.interfaces.nsIFileProtocolHandler);
				var lf = Components.classes["@mozilla.org/file/local;1"].
				  createInstance(Components.interfaces.nsILocalFile);
				lf.initWithPath(value["path"]);
				var f = lf.QueryInterface(Components.interfaces.nsIFile);
				var us = fph.getURLSpecFromFile(f);
				icon = "moz-icon://" + us + "?size=128";
			} else {
				//icon of a normal file
				icon = "moz-icon://." + fileExt + "?size=128";
			}
		} else if ((value["type"] == "FOLDER")) {
			//var ext = "icons_content/FOLDER.png";
			if (Browser.Platform.mac) {
				icon = "images/icons_content/FOLDER-OSX.png";
			} else if (Browser.Platform.win) {
				icon = "images/icons_content/FOLDER-WIN.png";
			} else {
				icon = "images/icons_content/FOLDER-GEN.png";
			}
		} else if ((value["type"] == "URL")) {				
			icon = "images/icons_content/URL.png";		
		} else if ((value["type"] == "NOTE") || (value["type"] == "TEXT") || (value["type"] == "HTML")) {
			icon = "images/icons_content/GEN.png";					
		}

		//set the X coordinate relative to the window width (it is stored in DB for the width 1000px)
		coordinatex = (value["coordinatex"]*(window.innerWidth/1000)).toFixed(parseInt(0));	
		coordinatey = (value["coordinatey"]*(window.innerHeight/1000)).toFixed(parseInt(0));	

		if (value["name"].replace(/<[^>]*>?/gm, '').length > 33) {
			name = value["name"].replace(/<[^>]*>?/gm, '').substring(0,33) + "...";
		} else {
			name = value["name"].replace(/_/gm, ' ');
		}

		//### BACKGROUND
		$("itemsList").adopt(
			new Element("div#item" + key, {
				styles : {
					width : "150",
					height : "46",
					position : "absolute",
					left : coordinatex,
					top : coordinatey,
					border : "0.1em solid",
					"border-radius": 5,
					"border-color": "rgba(112,138,144,0.2)",
				}
			})
		);
		//Set the background for notes, text and html
		if (value["type"] == "NOTE" || value["type"] == "TEXT" || value["type"] == "HTML") {
			if (value["width"] && value["height"]) {
				$("item" + key).setStyle('height', value["height"]);
				$("item" + key).setStyle('width', value["width"]);
			} else {
				$("item" + key).setStyle('height', '140px');
				data[key]["width"] = "150";
				data[key]["height"] = "140";
			}
			//$("item" + key).setStyle('background-image', 'url(images/note.png)');
			$("item" + key).setStyles({
						background : "#F7F7F7 url('images/dogear_small.png') no-repeat",
					    "background-position" : "100% 0%",
					    border : "1px dotted #ccc"});
		}

		//### ICON		
		if ((value["type"] == "FILE") || (value["type"] == "FOLDER") || (value["type"] == "URL")) {		
			$("item" + key).adopt( //"div#icon"
				new Element("div#icon" + key, {
					styles : {
						height : "60px",
					}
				}).adopt(
					new Element("img#iconimg" + key, {
						src : icon,
						alt : "Icon",
						title : "Expand information",				
						styles : {
							cursor : "pointer",
							width : "42px",
							position: "relative",
							top: "2px", 
							left: "0px",
							float: "left"
						},
						events : {
							click : function(){
								if ($("information" + key).getStyle("display") == "none") {
									$("information" + key).setStyle('display','block');
									//data[key]["display"] = "block";
								} else {
									$("information" + key).setStyle('display','none');
									//data[key]["display"] = "none";
								}							
							}
						}					
					})
				)
			);		
		} else if ((value["type"] == "NOTE") || (value["type"] == "TEXT") || (value["type"] == "HTML")) {
			if (value["width"]) {
				var xleft = value["width"]-10;
			} else {
				var xleft = "140px";
			}
			$("item" + key).adopt( //"div#icon"
				new Element("div#icon" + key, {
					styles : {
						height : "60px",
					}
				}).adopt(
					new Element("img#iconimg" + key, {
						src : icon,
						alt : "Icon",
						title : "Expand information",				
						styles : {
							cursor: "pointer",
							width : "20px",
							position: "absolute",
							top: "41px", 
							left: xleft,
							float: "left"
						},
						events : {
							click : function(){
								if ($("information" + key).getStyle("display") == "none") {
									$("information" + key).setStyle('display','block');
									//data[key]["display"] = "block";
								} else {
									$("information" + key).setStyle('display','none');
									//data[key]["display"] = "none";
								}							
							}
						}					
					})
				)
			);	
		}
		if (value["type"] == "FILE") {
			$("iconimg" + key).setStyles({width: 35, top: 5, left: 3 });
		}
		// get the favicon of an url and place it over the icon
		if (value["type"] == "URL") {
			var url = value["path"].match(/:\/\/(www[0-9]?\.)?(.[^/:]+)/)[2];
			var iconUrl = "http://getfavicon.appspot.com/http://" + url + "";
			//http://getfavicon.appspot.com/http://www.edocuments.co.uk'
			//http://grabicon.com/edocuments.co.uk'
			//http://www.getfavicon.org/?url=www.edocuments.co.uk' />
			//http://www.google.com/s2/favicons?domain=www.edocuments.co.uk' />
			$("item" + key).adopt(
				new Element("div#favicon" + key, {
				})
			);
			$("favicon" + key).adopt(
					new Element("img", {
						src : iconUrl,
						alt : "Icon",
						title : "Expand information",
						styles : {
							cursor: "pointer",
							width : "18px",
							position: "absolute",
							top: "13px", 
							left: "13px",
							"font-size": "10px"
						},
						events : {
							click : function(){
								if ($("information" + key).getStyle("display") == "none") {
									$("information" + key).setStyle('display','block');
									//data[key]["display"] = "block";
								} else {
									$("information" + key).setStyle('display','none');
									//data[key]["display"] = "none";
								}							
							}
						}
					})
			);		
		}
		//### MOVE
		$("item" + key).adopt( //span#move" + key
			new Element("span#move" + key).adopt(
				new Element("img#moveimg" + key, {
					src : "images/move-icon.png",
					alt : "Move",
					title : "Move",
					styles : {
						cursor: "move",						
						width : "23",
						position: "absolute",
						top: "28px", 
						left: "-5px"
					}
				})
			)
		);
		if ((value["type"] == "NOTE") || (value["type"] == "TEXT") || (value["type"] == "HTML")) {
			$("moveimg" + key).setStyle("left","-13px");
			$("moveimg" + key).setStyle("top","25px");
		}
		//### RESIZE NOTES
		if ((value["type"] == "NOTE") || (value["type"] == "TEXT") || (value["type"] == "HTML")) {
			if (value["width"] && value["height"]) {
				var xleft = value["width"]-10;
				var ytop = value["height"]-10;
			} else {
				var xleft = "139px";
				var ytop  = "129px";
			}
			$("item" + key).adopt( //span#move" + key
					new Element("img#resizeimg" + key, {
						src : "images/resize-icon.gif",
						alt : "Resize",
						title : "Resize",
						styles : {
							cursor : "se-resize",						
							position : "absolute",
							width : "11px",
							height : "11px",
							top : ytop, 
							left : xleft
						}
					})
			);
		}		

		//### Preview
		var imageTypes = ['png', 'jpg', 'jpeg', 'bmp', 'bmp', 'apng'];
		var textTypes = ['css','txt',''   ,'xml','csv','asc','bat' ,'log',
						 'c'  ,'cpp','h'  ,'hh' ,'hpp','hxx','h++' ,'cc' ,'cpp'  ,'cxx' ,'c++' ,
		 				 'ini','sql','rdf','rb' ,'rbw','sh' ,'bash','php','phtml','php4','php3','php5','phps',
						 'js' ,'jse','wsf','wsc','cs' ,'as' ,'java','pl' ,'pm'   ,'t'   ,'py'  ,'pyc' ,'pyo' ,
						 'asp','vbs','vbe','wsf','wsc',
						 'tex','bib','enl','ris', 'py','pyc','pyo' ,
						 'm3u']; 	
		var sourceTypes = ['NOTE', 'TEXT', 'HTML']; //these are tye types added when pieces of text are dropped or a note created
		if ((value["type"] == "URL") 
			|| sourceTypes.contains(value["type"])
			|| imageTypes.contains(fileExt.toLowerCase())
			|| textTypes.contains(fileExt.toLowerCase())) {		
			$("item" + key).adopt( //span#move" + key
				new Element("span#prev" + key).adopt(
					new Element("img#previmg" + key, {
						src : "images/icons_general/Search.png",
						alt : "Preview",
						title : "Preview",
						styles : {
							cursor: "pointer",						
							width : "20",
							position: "absolute",
							top: "30px", 
							left: "28px"
						},
						events : {
							click : function(){
								//notes
								if (sourceTypes.contains(value["type"])) {
							 		var profileBox = new LightFace({
										width: 800, 
										draggable: true,
										title: '',
										content: value["name"],
										buttons: [
											{ title: 'Close', event: function() { this.close(); }, color: 'blue' }
										]
									}).open();
								//images
							 	} else if (imageTypes.contains(fileExt.toLowerCase())) {
									var images = ['file://'+value["path"]];
									var light = new LightFace.Image({
										title: 'Image',
										fadeDuration: 100,
										keys: {
											esc: function() {
												this.close();
											}
										}
									}).addButton('Close', function() { light.close(); },true).load(images[0],'Image 1').open();
							 	//plain text	
							 	} else if (textTypes.contains(fileExt.toLowerCase())) {
							 		var light = new LightFace.IFrame({ height:500, width:800, url: 'view-source:file://'+value["path"], title: value["name"] }).addButton('Close', function() { light.close(); },true).open();						
							 	//external URLs in XUL for security reasons
							 	} else if (value["type"] == "URL") {
							 		tempURIforXUL = value['path'];
								    var light = new LightFace.IFrame({ height:500, width:800, url: "chrome://tic/content/sandbox.xul", title: value["name"] }).addButton('Close', function() { light.close(); },true).open();														    
							 	} 
							}
						}
					})
				)
			);
		}	
		if ((value["type"] == "NOTE") || (value["type"] == "TEXT") || (value["type"] == "HTML")) {
			if (value["width"]) {
				var xleft = value["width"]-8;
			} else {
				var xleft = "139px";
			}			
			$("previmg" + key).setStyle("left",xleft);
			$("previmg" + key).setStyle("top","62px");		
		}						
		//### TEXT/NAME
		if ((value["type"] == "FILE") || (value["type"] == "FOLDER") || (value["type"] == "URL")) {
			$("item" + key).adopt( //"span#name" + key
				new Element("span#name" + key,  {
					styles : {
						position: "absolute",
						width : "100",
						top: "2px",
						left : "45",
						"overflow": "hidden",
						"font-size": "12px"
					}
				}).adopt(
					new Element("a", {
						href : "#open",//value["path"],
						html : name,
						title : "Open",
						events : {
							click : function(){
								if ((value["type"] == "FILE") || (value["type"] == "FOLDER")) {
									//THE file launch AND file reveal WORK ON ALL PLATFORMS NOW!!!!
									//NO NEED FOR SPECIAL LINUX FILE MANAGER PROCESS RUN 
									fileOpen(value["path"]);
								} else if ((value["type"] == "TEXT") || (value["type"] == "HTML")) {
									//do nothing								 		
								} else if (value["type"] == "URL") {
									//URL's are opened in a window
									window.open(value["path"]);
								}
								return false;
							}
						}
					})
				)
			);	
		} else if ((value["type"] == "NOTE") || (value["type"] == "TEXT") || (value["type"] == "HTML")) {
			$("item" + key).setStyle("z-index","0");
			value["name"] = cleanHtml(value["name"]);
			data[key]["name"] = value["name"];
			if (value["type"] == "TEXT" || value["type"] == "NOTE") {
				value["name"] = value["name"].replace( /\n/gi, "<br />");	
			}
			if (value["width"] && value["height"]) {
				var xleft = value["width"]-10;
				var ytop = value["height"]-10;
			} else {
				var xleft = "135px";
				var ytop  = "130px";
			}							
			$("item" + key).adopt(
				new Element("div#textbox" + key, {
					styles : {
						top: "2px",
						width: xleft,
						height: ytop,
						position : "absolute",
						"overflow-y" : "hidden", //"scroll"
						"overflow-x" : "hidden"
					}
				}).adopt(
					new Element("div#nametext" + key, {
						//text: value["name"].replace(/<[^>]*>?/gm, ''),
						html: value["name"],
						styles: {
							position : "absolute",
							top: "2px",
							"font-size": "11px",
							"color": "#666666",
							padding : "5px 10px 10px 10px",
							"background": "rgba(0, 0, 0, 0)", /* transparent background */
							width: xleft-10,
							height: ytop,
							"text-overflow": "ellipsis",
							"font-family": "arial, sans-serif",
							"border-style": "none"//"1px solid"						
						},
						events: {
							dblclick : function(){
								editElementName(key);
							}				
						}
					})
				)
			);
		}

		//IMPORTANCE Upvote or Downvote VOTE & EMPHASIZE 
		var borderRed =		[112, 126, 140, 155, 169, 183, 197, 212, 226, 240, 255];
		var borderGreen =   [138, 124, 110, 97, 83, 69, 55, 41, 27, 14, 0];
		var borderBlue =	[144, 130, 116, 101, 87, 72, 57, 43, 29, 14, 0];
		var borderOpacity = [0.2, 0.2, 0.2, 0.3, 0.3, 0.3, 0.4, 0.4, 0.4, 0.5, 0.5];
		var borderWidth =   [0.1, 0.11, 0.12, 0.13, 0.14, 0.15, 0.16, 0.17, 0.18, 0.19, 0.20];
		$("item" + key).setStyle('border', borderWidth[value["vote"]] + 'em solid rgba(' + borderRed[value["vote"]] + ', ' + borderGreen[value["vote"]] + ', ' + borderBlue[value["vote"]] + ', ' + borderOpacity[value["vote"]] + ')');
		if (value["width"]) {
			var xleft = value["width"]-7;
		} else {
			var xleft = "143px";
		}		
		$("item" + key).adopt( //span#vote" + key			
			new Element("span#upvote" + key).adopt(
				new Element("img#upvoteimg" + key, {
					src : "images/upvote.png",
					alt : "Upvote importance",
					title : "Upvote importance",
					styles : {
						cursor : "pointer",						
						width : "15",
						position : "absolute",
						top : "7px", 
						left : xleft
					},
					events : {
						click : function(){
							if (value["vote"] < 10 && value["vote"] >= 0) {
								value["vote"]++;
								$("vote" + key).set('html' , value["vote"]);
								data[key]["vote"] = value["vote"];
								$("item" + key).setStyle('border', borderWidth[value["vote"]] + 'em solid rgba(' + borderRed[value["vote"]] + ', ' + borderGreen[value["vote"]] + ', ' + borderBlue[value["vote"]] + ', ' + borderOpacity[value["vote"]] + ')');
							} 
							return false;
						}
					}					
				})
			),
			new Element("span#vote" + key, { 
					text : value["vote"],
					title : "Importance on the scale 0 to 10",
					styles : {
						width : "13",
						position : "absolute",
						top : "16px", 
						"color" : "grey",
						"font-size" : "12px",
						left : xleft,
						"text-align" : "center",
						"background" : "white"
					}
			}),			
			new Element("span#downvote" + key).adopt(
				new Element("img#downvoteimg" + key, {
					src : "images/upvote.png",
					alt : "Downvote importance",
					title : "Downvote importance",
					styles : {
						cursor : "pointer",						
						width : "15",
						position : "absolute",
						top : "30px", 
						left : xleft,
						"-moz-transform" : "rotate(-180deg)",
						"-moz-transform-origin" : "center center"
					},
					events : {
						click : function(){
							if (value["vote"]>0 && value["vote"] <= 10) {
								value["vote"]--;
								$("vote" + key).set('html' , value["vote"]);
								data[key]["vote"] = value["vote"];
								$("item" + key).setStyle('border', borderWidth[value["vote"]] + 'em solid rgba(' + borderRed[value["vote"]] + ', ' + borderGreen[value["vote"]] + ', ' + borderBlue[value["vote"]] + ', ' + borderOpacity[value["vote"]] + ')');
							} 
							return false;
						}
					}
				})
			)					
		);		

		//ARROW pointing to the CENTRE & write coordinates of the item
		//Arrows used to define item as Input, Outpur or both to the task
		var angle = getAngle($("item" + key).offsetLeft,$("item" + key).offsetTop); 
		var imageSrc;
		if ((value["arrow"] == "no-no")) {
			imageSrc = 'images/arrow_no-no.png';
		} else if ((value["arrow"] == "in-no")) {
			imageSrc = 'images/arrow_in-no.png';
		} else if ((value["arrow"] == "no-out")) {
			imageSrc = 'images/arrow_no-out.png';	
		} else if ((value["arrow"] == "in-out"))  {
			imageSrc = 'images/arrow_in-out.png';
		} 
		$("item" + key).adopt( //"img#arrow" + key
			new Element ("a#arrowlink" + key, {
				href : "#inout",
				events : {
					click : function(){
						if ((value["arrow"] == "no-no")) {
							$("arrow" + key).erase('src');
							$("arrow" + key).set('src','images/arrow_in-no.png');
							data[key]["arrow"] = "in-no";
							//$("listarrow" + key).innerHTML = "<strong>arrow</strong>: " + data[key]["arrow"];							
						} else if ((value["arrow"] == "in-no")) {
							$("arrow" + key).erase('src');
							$("arrow" + key).set('src','images/arrow_no-out.png');
							data[key]["arrow"] = "no-out";
							//$("listarrow" + key).innerHTML = "<strong>arrow</strong>: " + data[key]["arrow"];
						} else if ((value["arrow"] == "no-out")) {
							$("arrow" + key).erase('src');
							$("arrow" + key).set('src','images/arrow_in-out.png');	
							data[key]["arrow"] = "in-out";
							//$("listarrow" + key).innerHTML = "<strong>arrow</strong>: " + data[key]["arrow"];
						} else if ((value["arrow"] == "in-out"))  {
							$("arrow" + key).erase('src');
							$("arrow" + key).set('src','images/arrow_no-no.png');
							data[key]["arrow"] = "no-no";
							//$("listarrow" + key).innerHTML = "<strong>arrow</strong>: " + data[key]["arrow"];
						} 
						return false;
					}
				}		
			}).adopt( 
				new Element("img#arrow" + key, {
					src : imageSrc,
					title : "Click to define if information is 'input' or 'output' to the task or both",
					styles : {
						position : "absolute",
						width : "20px",
					 	top : "46px",
					 	left : "-20px",
					 	"-moz-transform" : "rotate(" + angle[0] + "deg)",
					 	"-moz-transform-origin" : "center center"
					}
				})
			)
		);


		//set the display to none if it is undefined 
		//value["display"] is used to display or not to display $("information" + key) element
		$("item" + key).adopt( //"div#information" + key
			new Element("div#information" + key,  {
				styles : {
					position : "absolute",
					display : "none", //value["display"],
					width : "144",
					top : "55px",
					visibility : "visible",
					"font-size" : "12px",
					"z-index" : "3",
					"padding" : "3px",
					"background-color" : "white",
					border : "0.5px solid",
					"border-radius" : 5,
					"border-color" : "rgba(112,138,144,0.2)"						
				}
			})							
		);
		$("information" + key).adopt ( //"a#date" + key
			new Element("a#date" + key, {
				href : "#date"
			}).adopt(
				new Element("img", {
					src : "images/icons_general/Calendar.png",
					alt : "Add a due date",
					title : "Add a due date",
					styles : {					
						width : "23",
						height : "23",						
						opacity : "0.8"
					},
					events : {
						click : function(){
							var datetmp;
							if (value["date"]) {
								datetmp = value["date"];
							} else {
								datetmp = "YYYY-MM-DD";
							}
							//fire up a prompt message
							var duedate = prompt("Please enter the due date for this information",datetmp);
							var regDate = new RegExp("^(19|20)[0-9][0-9]-(0[1-9]|1[012])-(0[1-9]|[12][0-9]|3[01])$");
							var valid = new Date(duedate).isValid();
							if ((duedate.test(regDate) == true) && (valid == true)) {
  								addElementValue(key,"date",duedate);
							} else {
								alert("Date format is wrong: " + duedate + "!");
							}
						}
					}					
				})
			)	
		);
		$("information" + key).adopt ( //"a#user" + key
			new Element("a#user" + key, {
				href : "#user"
			}).adopt(
				new Element("img", {
					src : "images/icons_general/User.png",
					alt : "Add a person's name to the item",
					title : "Add a person",					
					styles : {						
						width : "23",
						height : "23",						
						opacity : "0.8"
					},
					events : {
						click : function(){		
							var persontmp;
							if (value["person"]) {
								persontmp = value["person"];
							} else {
								persontmp = "Add a person's name or other information to the item";
							}										
							//call function that saves the changed text
							var person = prompt("Please enter the details of a person associated with this information",persontmp);
							if (person != null) {
  								addElementValue(key,"person",person);
							} 
						}
					}					
				})
			)	
		);
		$("information" + key).adopt ( //"a#email" + key
			new Element("a#email" + key, {
				href : "#email"
			}).adopt(
				new Element("img", {
					src : "images/icons_general/Address_Book.png",
					alt : "Add an email address",
					title : "Add an email address",
					styles : {						
						width : "23",
						height : "23",		 				
						opacity : "0.8"
					},
					events : {
						click : function(){
							var emailtmp;
							if (value["email"]) {
								emailtmp = value["email"];
							} else {
								emailtmp = "Add an email address";
							}								
							//call function that saves the changed text
							var email = prompt("Please enter the email address of a person associated with this information",emailtmp);
							if (email != null) {
  								addElementValue(key,"email",email);
							}
						}
					}					
				})
			)	
		);	
		$("information" + key).adopt ( //"a#url" + key
			new Element("a#url" + key, {
				href : "#url"
			}).adopt(
				new Element("img", {
					src : "images/icons_general/Internet.png",
					alt : "Add an URL",
					title : "Add an URL",
					styles : {						
						width : "23",
						height : "23",		 				
						opacity : "0.8"
					},
					events : {
						click : function(){
							var urltmp;
							if (value["url"]) {
								urltmp = value["url"];
							} else {
								urltmp = "http ://";
							}								
							//call function that saves the changed text
							var url = prompt("Please enter the URL address associated with this information",urltmp);
							if (url != null) {
  								addElementValue(key,"url",url);
							} 
						}
					}					
				})
			)	
		);
		$("information" + key).adopt ( //"a#note" + key
			new Element("a#note" + key, {
				href : "#note"
			}).adopt(
				new Element("img", {
					src : "images/icons_general/Notepad2.png",
					alt : "Add a note",
					title : "Add a note",
					styles : {						
						width : "23",
						height : "23",		 				
						opacity : "0.8"
					},
					events : {
						click : function(){
							var notetmp;
							if (value["note"]) {
								notetmp = value["note"];
							} else {
								notetmp = "Add an note";
							}								
							//call function that saves the changed text
							var note = prompt("Please enter a note about this information",notetmp);
							if (note != null) {
  								addElementValue(key,"note",note);
							} 
						}
					}					
				})
			)	
		);						
		$("information" + key).adopt ( //"a#delete" + key
			new Element("a#delete" + key, {
				href : "#delete"
			}).adopt(
				new Element("img", {
					src : "images/icons_general/RecycleBin_Empty.png",
					alt : "Remove item",
					title : "Remove from here",
					styles : {					
						width : "23",
						height : "23",
						opacity : "0.8"
					},
					events : {
						click : function(){
							//fire up the confirmation box
							var question = confirm("Really remove the item '" + value["name"] + "'? This will NOT delete the source item - e.g. the file or folder on the hard drive!");
							if (question == true){
								deleteElement(key,name);
							} else {
								//alert("?");
							}
							
						}
					}					
				})
			)
		);	
		//move this extra info box more down for notes
		if ((value["type"] == "NOTE") || (value["type"] == "TEXT") || (value["type"] == "HTML")) {
			if (value["height"]) {
				var ytop = parseInt(value["height"])+5;
			} else {
				var ytop = "150px";
			}	
			$("information" + key).setStyle('top', ytop);
		}	

		//print more information about the information item
		Object.each(value, function(item,index){
			if ((index != "display") && (index != "coordinatex") && (index != "coordinatey") 
				&& (index != "extension") && (index != "type")  && (index != "arrow")
				&& (index != "vote") && (index != "timestamp") && (index != "width")
				&& (index != "height")) {

				var indivElement  = new Element("div#list" + index + key);

				//get current size and make it human readable
				if (index == "size"  && value["type"] == "FILE") {
					var updatedSize = fileSizes(data[key]["path"]);
					data[key]["size"] = updatedSize;
					item = bytesToSize(updatedSize);	
				} else if (index == "size"  && value["type"] != "FILE") {
					delete data[key]["size"];
				}
				//make paths and links clickable
				if (index == "path" && (value["type"] == "FILE" || value["type"] == "FOLDER")) {
					indivElement.set({
						html: "<a href=\"#openfolder\">" + item + "</a>",
					    events: {
					        click: function(){ folderOpen(value["path"]) }
					    }
					});								
				} else if (index == "email") {
					indivElement.set({
					    html : "<strong>" + index + "</strong>: <a href=\"mailto:"+ item +"\">" + item + "</a>"
					});							 
				} else if (index == "url") {
					indivElement.set({
					    html : "<strong>" + index + "</strong>: <a href=\""+ item +"\">" + item + "</a>"
					});							 
				} 
				//get current modificaion time and make it human readable
				if (index == "modified"){
					var updatedModified = fileModified(data[key]["path"]);
					data[key]["modified"] = updatedModified;
					if (updatedModified == "not available") {
						item = updatedModified;					
					} else {
						item = unixToTime(updatedModified);						
					}						
				}
				//emphasize the item if the due date is approaching and is in less than 7 days
				if (index == "date"){
    				checkDateElement(item,key);
				}	
				//don't print names for notes
				if (index == "name" && ((value["type"] == "NOTE") || (value["type"] == "TEXT") || (value["type"] == "HTML"))) {
					item = "A note";						
				}				

				if (indivElement.get('html') == ""){
					indivElement.set({
						html : "<strong>" + index + "</strong>: " + item
					});					
				}

				$("information" + key).adopt (indivElement);	
			} 
		});	

		//check for overlaping tasks for the informatuon item - 
		// if they share information items get array of tasks IDs
		if ((value["type"] == "FILE") || (value["type"] == "FOLDER") || (value["type"] == "URL")) {
			//get the table and erease the id of the selected task
		 	var overlapingTasks = databaseOverlapingTasks(value["path"]).erase(currentTaskId);
		 	var leftStep = -13;
		 	if (overlapingTasks.length != 0) { 	
				Array.each(overlapingTasks, function(id, index){
					leftStep = leftStep + 21;
					$("item" + key).adopt( //"span#icon"
						new Element("a", {
							href : "#jumpToTask",
							text : id,
							title : "Jump to task '" + databaseGetTaskName(id) + "'",
							styles : {
								position : "absolute",
								left : leftStep + "px",
								top : "-20px",
								width : "20px",
								height : "20px",	
								"font-size" : "11px",
								"line-height" : "20px",
								display : "inline-block",
								"border-radius" : "20px",
								"background-color" : "rgba(112,138,144,0.6)",
								"text-align" : "center"
							},
							events : {
								click : function(){
									databaseSaveTaskCollection(databaseDrawTaskCollection, id);
								}
							}		
						})
					);
				});
			}
		} 
		
		//make elements movable
		new Drag.Move($("item" + key), {
			handle : $("move" + key), //make the move arrows the handle to move elements
			container : $("body"), //limit the moves within the window
			onDrop: function(){
				//change the X coordinates of the new element to the default width 1000px
				//we need this to position the elements right if the window is resized			
				data[key].coordinatex = ($("item" + key).offsetLeft/(window.innerWidth/1000)).toFixed(parseInt(0));
				data[key].coordinatey = ($("item" + key).offsetTop/(window.innerHeight/1000)).toFixed(parseInt(0));
				//if x goes under tabs (projects & timeline), move it to the right
				if (data[key].coordinatex < 40) {
					data[key].coordinatex = 40;
					$("item" + key).setStyle('left' , data[key].coordinatex);
				}
				//ARROW pointing to the CENTRE
				var angle = getAngle($("item" + key).offsetLeft,$("item" + key).offsetTop); 
				$("arrow" + key).setStyle("-moz-transform", "rotate(" + angle[0] + "deg)");
			}
		}); 

		//make notes resizable
		if ((value["type"] == "NOTE") || (value["type"] == "TEXT") || (value["type"] == "HTML")) {
			$("item" + key).makeResizable({
				limit: {x: [150, 600], y: [90, 500]},
				handle : $("resizeimg" + key),
				onComplete: function(){
					if ($("item" + key).contains($("nametext" + key))) {
	    			    $("nametext" + key).set('html', value["name"]);
	    			}
					data[key].width = ($("item" + key).getSize().x - 6);
					data[key].height = ($("item" + key).getSize().y - 6);
   				},
				onDrag: function(){
					var newWidth = $("item" + key).getSize().x - 12;
					var newHeight = $("item" + key).getSize().y - 12;
					$("iconimg" + key).setStyle('left', newWidth);
					$("previmg" + key).setStyle('left', newWidth+2);
					$("upvoteimg" + key).setStyle('left', newWidth);
					$("downvoteimg" + key).setStyle('left', newWidth);					
					$("vote" + key).setStyle('left', newWidth+1);
					$("textbox" + key).setStyles({'width': newWidth, 'height': newHeight});
					if ($("item" + key).contains($("nametext" + key))) {
						$("nametext" + key).setStyles({'width': newWidth, 'height': newHeight});
					}
					$("resizeimg" + key).setStyles({'left': newWidth-4, 'top': newHeight-4});
					$("information" + key).setStyle('top', newHeight+15);
					if ($("item" + key).contains($("emphasizedate" + key))) {
						$("emphasizedate" + key).setStyles({'left': (newWidth)/2-25, 'top': newHeight+7});
					}					
   				}   				
			});
		}

	});
}

function drawTICElementsPastStates(pastStatesId) {

	var coordinatexPastStates = "";
	var iconPastStates = "";
	var namePastStates = "";
	//empty the div with all items before starting puting items of a new task in
	$("itemsList").empty();
	var statement = connection.createStatement("SELECT * FROM tasks_collections WHERE coll_id = :cid");	
	statement.params.cid = pastStatesId;
	//MOZ_STORAGE_STATEMENT_READY 	1 	The SQL statement is ready to be executed.
	if (statement.state == 1) {
		statement.executeStep();
		var dataPastStates = JSON.decode(statement.row.coll_items);
		var timestamp = statement.row.coll_timestamp;
		$("tasknametext").set('html' , currentTaskName + "<br/>" + timestamp);

		// draw all elements from the data object
		Object.each (dataPastStates, function(value, key){

			//find item type and icon
			var fileExt = value["name"].split(".").getLast(); //get the last dot & take what's after it
			if ((value["type"] == "FILE")) {
				if (fileExt.toLowerCase() == "exe") {
					//icon of EXE file - program or software  
					var ios = Components.classes["@mozilla.org/network/io-service;1"].
					  getService(Components.interfaces.nsIIOService);
					var fph = ios.getProtocolHandler("file").
					  QueryInterface(Components.interfaces.nsIFileProtocolHandler);
					var lf = Components.classes["@mozilla.org/file/local;1"].
					  createInstance(Components.interfaces.nsILocalFile);
					lf.initWithPath(value["path"]);
					var f = lf.QueryInterface(Components.interfaces.nsIFile);
					var us = fph.getURLSpecFromFile(f);
					icon = "moz-icon://" + us + "?size=128";
				} else {
					//icon of a normal file
					icon = "moz-icon://." + fileExt + "?size=128";
				}
			} else if ((value["type"] == "FOLDER")) {
				//var ext = "icons_content/FOLDER.png";
				if (Browser.Platform.mac) {
					icon = "images/icons_content/FOLDER-OSX.png";
				} else if (Browser.Platform.win) {
					icon = "images/icons_content/FOLDER-WIN.png";
				} else {
					icon = "images/icons_content/FOLDER-GEN.png";
				}
			} else if ((value["type"] == "URL")) {				
				icon = "images/icons_content/URL.png";		
			} else if ((value["type"] == "NOTE") || (value["type"] == "TEXT") || (value["type"] == "HTML")) {
				icon = "images/icons_content/GEN.png";					
			}

			//set the X coordinate relative to the window width (it is stored in DB for the width 1000px)
			coordinatex = (value["coordinatex"]*(window.innerWidth/1000)).toFixed(parseInt(0));	
			coordinatey = (value["coordinatey"]*(window.innerHeight/1000)).toFixed(parseInt(0));	

			if (value["name"].replace(/<[^>]*>?/gm, '').length > 33) {
				name = value["name"].replace(/<[^>]*>?/gm, '').substring(0,33) + "...";
			} else {
				name = value["name"].replace(/_/gm, ' ');
			}

			//### BACKGROUND
			$("itemsList").adopt(
				new Element("div#item" + key, {
					styles : {
						width : "150",
						height : "46",
						position : "absolute",
						left : coordinatex,
						top : coordinatey,
						border : "0.1em solid",
						"border-radius": 5,
						"border-color": "rgba(112,138,144,0.2)",
					}
				})
			);
			//Set the background for notes, text and html
			if (value["type"] == "NOTE" || value["type"] == "TEXT" || value["type"] == "HTML") {
				if (value["width"] && value["height"]) {
					$("item" + key).setStyle('height', value["height"]);
					$("item" + key).setStyle('width', value["width"]);
				} else {
					$("item" + key).setStyle('height', '140px');
				}
				//$("item" + key).setStyle('background-image', 'url(images/note.png)');
				$("item" + key).setStyles({
							background : "#F7F7F7 url('images/dogear_small.png') no-repeat",
						    "background-position" : "100% 0%",
						    border : "1px dotted #ccc"});
			}

			//### ICON		
			if ((value["type"] == "FILE") || (value["type"] == "FOLDER") || (value["type"] == "URL")) {		
				$("item" + key).adopt( //"div#icon"
					new Element("div#icon" + key, {
						styles : {
							height : "60px",
						}
					}).adopt(
						new Element("img#iconimg" + key, {
							src : icon,
							alt : "Icon",
							title : "Expand information",				
							styles : {
								cursor : "pointer",
								width : "42px",
								position: "relative",
								top: "2px", 
								left: "0px",
								float: "left"
							},
							events : {
								click : function(){
									if ($("information" + key).getStyle("display") == "none") {
										$("information" + key).setStyle('display','block');
										//data[key]["display"] = "block";
									} else {
										$("information" + key).setStyle('display','none');
										//data[key]["display"] = "none";
									}							
								}
							}					
						})
					)
				);		
			} else if ((value["type"] == "NOTE") || (value["type"] == "TEXT") || (value["type"] == "HTML")) {
				if (value["width"]) {
					var xleft = value["width"]-10;
				} else {
					var xleft = "140px";
				}
				$("item" + key).adopt( //"div#icon"
					new Element("div#icon" + key, {
						styles : {
							height : "60px",
						}
					}).adopt(
						new Element("img#iconimg" + key, {
							src : icon,
							alt : "Icon",
							title : "Expand information",				
							styles : {
								cursor: "pointer",
								width : "20px",
								position: "absolute",
								top: "41px", 
								left: xleft,
								float: "left"
							},
							events : {
								click : function(){
									if ($("information" + key).getStyle("display") == "none") {
										$("information" + key).setStyle('display','block');
										//data[key]["display"] = "block";
									} else {
										$("information" + key).setStyle('display','none');
										//data[key]["display"] = "none";
									}							
								}
							}					
						})
					)
				);	
			}
			if (value["type"] == "FILE") {
				$("iconimg" + key).setStyles({width: 35, top: 5, left: 3 });
			}
			// get the favicon of an url and place it over the icon
			if (value["type"] == "URL") {
				var url = value["path"].match(/:\/\/(www[0-9]?\.)?(.[^/:]+)/)[2];
				var iconUrl = "http://getfavicon.appspot.com/http://" + url + "";
				//http://getfavicon.appspot.com/http://www.edocuments.co.uk'
				//http://grabicon.com/edocuments.co.uk'
				//http://www.getfavicon.org/?url=www.edocuments.co.uk' />
				//http://www.google.com/s2/favicons?domain=www.edocuments.co.uk' />
				$("item" + key).adopt(
					new Element("div#favicon" + key, {
					})
				);
				$("favicon" + key).adopt(
						new Element("img", {
							src : iconUrl,
							alt : "Icon",
							title : "Expand information",
							styles : {
								cursor: "pointer",
								width : "18px",
								position: "absolute",
								top: "13px", 
								left: "13px",
								"font-size": "10px"
							},
							events : {
								click : function(){
									if ($("information" + key).getStyle("display") == "none") {
										$("information" + key).setStyle('display','block');
										//data[key]["display"] = "block";
									} else {
										$("information" + key).setStyle('display','none');
										//data[key]["display"] = "none";
									}							
								}
							}
						})
				);		
			}		

			//### Preview
			var imageTypes = ['png', 'jpg', 'jpeg', 'bmp', 'bmp', 'apng'];
			var textTypes = ['css','txt',''   ,'xml','csv','asc','bat' ,'log',
							 'c'  ,'cpp','h'  ,'hh' ,'hpp','hxx','h++' ,'cc' ,'cpp'  ,'cxx' ,'c++' ,
			 				 'ini','sql','rdf','rb' ,'rbw','sh' ,'bash','php','phtml','php4','php3','php5','phps',
							 'js' ,'jse','wsf','wsc','cs' ,'as' ,'java','pl' ,'pm'   ,'t'   ,'py'  ,'pyc' ,'pyo' ,
							 'asp','vbs','vbe','wsf','wsc',
							 'tex','bib','enl','ris', 'py','pyc','pyo' ,
							 'm3u']; 	
			var sourceTypes = ['NOTE', 'TEXT', 'HTML']; //these are tye types added when pieces of text are dropped or a note created
			if ((value["type"] == "URL") 
				|| sourceTypes.contains(value["type"])
				|| imageTypes.contains(fileExt.toLowerCase())
				|| textTypes.contains(fileExt.toLowerCase())) {		
				$("item" + key).adopt( //span#move" + key
					new Element("span#prev" + key).adopt(
						new Element("img#previmg" + key, {
							src : "images/icons_general/Search.png",
							alt : "Preview",
							title : "Preview",
							styles : {
								cursor: "pointer",						
								width : "20",
								position: "absolute",
								top: "30px", 
								left: "28px"
							},
							events : {
								click : function(){
									//notes
									if (sourceTypes.contains(value["type"])) {
								 		var profileBox = new LightFace({
											width: 800, 
											draggable: true,
											title: '',
											content: value["name"],
											buttons: [
												{ title: 'Close', event: function() { this.close(); }, color: 'blue' }
											]
										}).open();
									//images
								 	} else if (imageTypes.contains(fileExt.toLowerCase())) {
										var images = ['file://'+value["path"]];
										var light = new LightFace.Image({
											title: 'Image',
											fadeDuration: 100,
											keys: {
												esc: function() {
													this.close();
												}
											}
										}).addButton('Close', function() { light.close(); },true).load(images[0],'Image 1').open();
								 	//plain text	
								 	} else if (textTypes.contains(fileExt.toLowerCase())) {
								 		var light = new LightFace.IFrame({ height:500, width:800, url: 'view-source:file://'+value["path"], title: value["name"] }).addButton('Close', function() { light.close(); },true).open();						
								 	//external URLs in XUL for security reasons
								 	} else if (value["type"] == "URL") {
								 		tempURIforXUL = value['path'];
									    var light = new LightFace.IFrame({ height:500, width:800, url: "chrome://tic/content/sandbox.xul", title: value["name"] }).addButton('Close', function() { light.close(); },true).open();														    
								 	} 
								}
							}
						})
					)
				);
			}	
			if ((value["type"] == "NOTE") || (value["type"] == "TEXT") || (value["type"] == "HTML")) {
				if (value["width"]) {
					var xleft = value["width"]-8;
				} else {
					var xleft = "139px";
				}			
				$("previmg" + key).setStyle("left",xleft);
				$("previmg" + key).setStyle("top","62px");		
			}						
			//### TEXT/NAME
			if ((value["type"] == "FILE") || (value["type"] == "FOLDER") || (value["type"] == "URL")) {
				$("item" + key).adopt( //"span#name" + key
					new Element("span#name" + key,  {
						styles : {
							position: "absolute",
							width : "100",
							top: "2px",
							left : "45",
							"overflow": "hidden",
							"font-size": "12px"
						}
					}).adopt(
						new Element("a", {
							href : "#open",//value["path"],
							html : name,
							title : "Open",
							events : {
								click : function(){
									if ((value["type"] == "FILE") || (value["type"] == "FOLDER")) {
										//THE file launch AND file reveal WORK ON ALL PLATFORMS NOW!!!!
										//NO NEED FOR SPECIAL LINUX FILE MANAGER PROCESS RUN 
										fileOpen(value["path"]);
									} else if ((value["type"] == "TEXT") || (value["type"] == "HTML")) {
										//do nothing								 		
									} else if (value["type"] == "URL") {
										//URL's are opened in a window
										window.open(value["path"]);
									}
									return false;
								}
							}
						})
					)
				);	
			} else if ((value["type"] == "NOTE") || (value["type"] == "TEXT") || (value["type"] == "HTML")) {
				$("item" + key).setStyle("z-index","0");
				value["name"] = cleanHtml(value["name"]);
				//data[key]["name"] = value["name"];
				if (value["type"] == "TEXT" || value["type"] == "NOTE") {
					value["name"] = value["name"].replace( /\n/gi, "<br />");	
				}
				if (value["width"] && value["height"]) {
					var xleft = value["width"]-10;
					var ytop = value["height"]-10;
				} else {
					var xleft = "135px";
					var ytop  = "130px";
				}							
				$("item" + key).adopt(
					new Element("div#textbox" + key, {
						styles : {
							top: "2px",
							width: xleft,
							height: ytop,
							position : "absolute",
							"overflow-y" : "hidden", //"scroll"
							"overflow-x" : "hidden"
						}
					}).adopt(
						new Element("div#nametext" + key, {
							//text: value["name"].replace(/<[^>]*>?/gm, ''),
							html: value["name"],
							styles: {
								position : "absolute",
								top: "2px",
								"font-size": "11px",
								"color": "#666666",
								padding : "5px 10px 10px 10px",
								"background": "rgba(0, 0, 0, 0)", /* transparent background */
								width: xleft-10,
								height: ytop,
								"text-overflow": "ellipsis",
								"font-family": "arial, sans-serif",
								"border-style": "none"//"1px solid"						
							}
						})
					)
				);
			}

			//IMPORTANCE Upvote or Downvote VOTE & EMPHASIZE 
			var borderRed =		[112, 126, 140, 155, 169, 183, 197, 212, 226, 240, 255];
			var borderGreen =   [138, 124, 110, 97, 83, 69, 55, 41, 27, 14, 0];
			var borderBlue =	[144, 130, 116, 101, 87, 72, 57, 43, 29, 14, 0];
			var borderOpacity = [0.2, 0.2, 0.2, 0.3, 0.3, 0.3, 0.4, 0.4, 0.4, 0.5, 0.5];
			var borderWidth =   [0.1, 0.11, 0.12, 0.13, 0.14, 0.15, 0.16, 0.17, 0.18, 0.19, 0.20];
			$("item" + key).setStyle('border', borderWidth[value["vote"]] + 'em solid rgba(' + borderRed[value["vote"]] + ', ' + borderGreen[value["vote"]] + ', ' + borderBlue[value["vote"]] + ', ' + borderOpacity[value["vote"]] + ')');
			if (value["width"]) {
				var xleft = value["width"]-7;
			} else {
				var xleft = "143px";
			}		
			$("item" + key).adopt( //span#vote" + key			
				new Element("span#upvote" + key).adopt(
					new Element("img#upvoteimg" + key, {
						src : "images/upvote.png",
						alt : "Upvote importance",
						title : "Upvote importance",
						styles : {
							width : "15",
							position : "absolute",
							top : "7px", 
							left : xleft
						}					
					})
				),
				new Element("span#vote" + key, { 
						text : value["vote"],
						title : "Importance on the scale 0 to 10",
						styles : {
							width : "13",
							position : "absolute",
							top : "16px", 
							"color" : "grey",
							"font-size" : "12px",
							left : xleft,
							"text-align" : "center",
							"background" : "white"
						}
				}),			
				new Element("span#downvote" + key).adopt(
					new Element("img#downvoteimg" + key, {
						src : "images/upvote.png",
						alt : "Downvote importance",
						title : "Downvote importance",
						styles : {
							width : "15",
							position : "absolute",
							top : "30px", 
							left : xleft,
							"-moz-transform" : "rotate(-180deg)",
							"-moz-transform-origin" : "center center"
						}
					})
				)					
			);		

			//ARROW pointing to the CENTRE & write coordinates of the item
			//Arrows used to define item as Input, Outpur or both to the task
			var angle = getAngle($("item" + key).offsetLeft,$("item" + key).offsetTop); 
			var imageSrc;
			if ((value["arrow"] == "no-no")) {
				imageSrc = 'images/arrow_no-no.png';
			} else if ((value["arrow"] == "in-no")) {
				imageSrc = 'images/arrow_in-no.png';
			} else if ((value["arrow"] == "no-out")) {
				imageSrc = 'images/arrow_no-out.png';	
			} else if ((value["arrow"] == "in-out"))  {
				imageSrc = 'images/arrow_in-out.png';
			} 
			$("item" + key).adopt( 
					new Element("img#arrow" + key, {
						src : imageSrc,
						title : "Click to define if information is 'input' or 'output' to the task or both",
						styles : {
							position : "absolute",
							width : "20px",
						 	top : "46px",
						 	left : "-20px",
						 	"-moz-transform" : "rotate(" + angle[0] + "deg)",
						 	"-moz-transform-origin" : "center center"
						}
					})
			);


			//set the display to none if it is undefined 
			//value["display"] is used to display or not to display $("information" + key) element
			$("item" + key).adopt( //"div#information" + key
				new Element("div#information" + key,  {
					styles : {
						position : "absolute",
						display : "none", //value["display"],
						width : "144",
						top : "55px",
						visibility : "visible",
						"font-size" : "12px",
						"z-index" : "3",
						"padding" : "3px",
						"background-color" : "white",
						border : "0.5px solid",
						"border-radius" : 5,
						"border-color" : "rgba(112,138,144,0.2)"						
					}
				})							
			);
			$("information" + key).adopt ( //"a#date" + key
					new Element("img", {
						src : "images/icons_general/Calendar.png",
						alt : "Add a due date",
						title : "Add a due date",
						styles : {					
							width : "23",
							height : "23",						
							opacity : "0.8"
						}					
					})
			);
			$("information" + key).adopt ( //"a#user" + key
					new Element("img", {
						src : "images/icons_general/User.png",
						alt : "Add a person's name to the item",
						title : "Add a person",					
						styles : {						
							width : "23",
							height : "23",						
							opacity : "0.8"
						}					
					})
			);
			$("information" + key).adopt ( //"a#email" + key
					new Element("img", {
						src : "images/icons_general/Address_Book.png",
						alt : "Add an email address",
						title : "Add an email address",
						styles : {						
							width : "23",
							height : "23",		 				
							opacity : "0.8"
						}					
					})
			);	
			$("information" + key).adopt ( //"a#url" + key
					new Element("img", {
						src : "images/icons_general/Internet.png",
						alt : "Add an URL",
						title : "Add an URL",
						styles : {						
							width : "23",
							height : "23",		 				
							opacity : "0.8"
						}					
					})
			);
			$("information" + key).adopt ( //"a#note" + key
					new Element("img", {
						src : "images/icons_general/Notepad2.png",
						alt : "Add a note",
						title : "Add a note",
						styles : {						
							width : "23",
							height : "23",		 				
							opacity : "0.8"
						}					
					})
			);						
			$("information" + key).adopt ( //"a#delete" + key
					new Element("img", {
						src : "images/icons_general/RecycleBin_Empty.png",
						alt : "Remove item",
						title : "Remove from here",
						styles : {					
							width : "23",
							height : "23",
							opacity : "0.8"
						}					
					})
			);	
			//move this extra info box more down for notes
			if ((value["type"] == "NOTE") || (value["type"] == "TEXT") || (value["type"] == "HTML")) {
				if (value["height"]) {
					var ytop = value["height"]+5;
				} else {
					var ytop = "150px";
				}	
				$("information" + key).setStyle('top', ytop);						
			}	

			//print more information about the information item
			Object.each(value, function(item,index){
				if ((index != "display") && (index != "coordinatex") && (index != "coordinatey") 
					&& (index != "extension") && (index != "type")  && (index != "arrow")
					&& (index != "vote") && (index != "timestamp") && (index != "width")
					&& (index != "height")) {

					var indivElement  = new Element("div#list" + index + key);

					//get current size and make it human readable
					if (index == "size"  && value["type"] == "FILE") {
						item = bytesToSize(value["size"]);	
					} else if (index == "size"  && value["type"] != "FILE") {
						delete value["size"];
					}
					//make paths and links clickable
					if (index == "path" && (value["type"] == "FILE" || value["type"] == "FOLDER")) {
						indivElement.set({
							html: "<a href=\"#openfolder\">" + item + "</a>",
						    events: {
						        click: function(){ folderOpen(value["path"]) }
						    }
						});								
					} else if (index == "email") {
						indivElement.set({
						    html : "<strong>" + index + "</strong>: <a href=\"mailto:"+ item +"\">" + item + "</a>"
						});							 
					} else if (index == "url") {
						indivElement.set({
						    html : "<strong>" + index + "</strong>: <a href=\""+ item +"\">" + item + "</a>"
						});							 
					} 
					//get current modificaion time and make it human readable
					if (index == "modified"){
						item = unixToTime(value["modified"]);											
					}
					//emphasize the item if the due date is approaching and is in less than 7 days
					if (index == "date"){
	    				checkDateElement(item,key);
					}	
					//don't print names for notes
					if (index == "name" && ((value["type"] == "NOTE") || (value["type"] == "TEXT") || (value["type"] == "HTML"))) {
						item = "A note";						
					}				

					if (indivElement.get('html') == ""){
						indivElement.set({
							html : "<strong>" + index + "</strong>: " + item
						});					
					}

					$("information" + key).adopt (indivElement);	
				} 
			});	

			//check for overlaping tasks for the informatuon item - 
			// if they share information items get array of tasks IDs
			if ((value["type"] == "FILE") || (value["type"] == "FOLDER") || (value["type"] == "URL")) {
				//get the table and erease the id of the selected task
			 	var overlapingTasks = databaseOverlapingTasks(value["path"]).erase(currentTaskId);
			 	var leftStep = -13;
			 	if (overlapingTasks.length != 0) { 	
					Array.each(overlapingTasks, function(id, index){
						leftStep = leftStep + 21;
						$("item" + key).adopt( //"span#icon"
							new Element("a", {
								href : "#jumpToTask",
								text : id,
								title : "Jump to task '" + databaseGetTaskName(id) + "'",
								styles : {
									position : "absolute",
									left : leftStep + "px",
									top : "-20px",
									width : "20px",
									height : "20px",	
									"font-size" : "11px",
									"line-height" : "20px",
									display : "inline-block",
									"border-radius" : "20px",
									"background-color" : "rgba(112,138,144,0.6)",
									"text-align" : "center"
								},
								events : {
									click : function(){
										databaseSaveTaskCollection(databaseDrawTaskCollection, id);
									}
								}		
							})
						);
					});
				}
			} 


		});
		//empty the object as it cannot be edited and we don't need it anymore.
		dataPastStates = {};
	} else {
		printOut("Not a valid SQL statement: SELECT * FROM tasks_collections WHERE coll_id = :cid");
	}			
}

function playDrawTICElementsPastStates() {
	if (pastTICStatesCurrentIndex == pastTICStatesIds.length) {
		pastTICStatesCurrentIndex = 0;
	}

	//clear the background of the previously selected past state
	if (pastTICStatesCurrentIndex != 0) {
		var prev = parseInt(pastTICStatesCurrentIndex)-1;
    	$("pastState" + prev).setStyle('background-color', null);
    } else if (pastTICStatesCurrentIndex == 0) {
    	var prev = pastTICStatesIds.length-1;
    	$("pastState" + prev).setStyle('background-color', null);
    }

	$("pastState" + pastTICStatesCurrentIndex).setStyle('background-color', '#ffffcc');
	drawTICElementsPastStates(pastTICStatesIds[pastTICStatesCurrentIndex]);
	pastTICStatesCurrentIndex = pastTICStatesCurrentIndex + 1;
}

function startDrawTICElementsPastStates() {
	pastTICStatesInterval = playDrawTICElementsPastStates.periodical(1000);
}

function stopDrawTICElementsPastStates(pastStatesId) {
	$clear(pastTICStatesInterval);
}

/***************************************************************************
Add, edit and delete elements and their values
The function are called:
addElementValue(key,tag,value): 
	- drawTICElements(): append to buttons to add date, person, url, note
deleteElementValue(key,tag,value):
	- not used anywhere yet
editElementName(key):
	- drawTICElements(): edit content of notes by doubleclicking on it
deleteElement(key, name): deleting the information item
	- drawTICElements(): append to delete icon of every item/element on the page
checkDateElement(date,key): check if the due date is approaching and emphasize the value	
	- drawTICElements(): called for every item if it needs to be emphasized
	- addElementValue(key,tag,value): check if the newly added value is date
	  and it needs to be amphasized
****************************************************************************/

function addElementValue(key,tag,value) { //adding a value/tag of the information item
	data[key][tag] = value;
	//we can't just draw because we don't save the new value in DB so the nev value is lost
	//databaseDrawTaskCollection(currentTaskId);

	//add or change the existng valuein th DOM
	if ($("information" + key).contains($("list" + tag + key))) {
		$("list" + tag + key).dispose();
	}
	$("information" + key).adopt ( //"span#content_" + key
		new Element("div#list" + tag + key, {
			html : "<strong>" + tag + "</strong>: " + value
		})
	);	

	//if the date has been changed ... emphasize the border
    if (tag == "date") {
    	checkDateElement(value,key);
    }
}

function deleteElementValue(key,tag,value) { //deleting a value/tag of the information item
	//data[key].tag = value;
}

function editElementName(key) { //edit the name=content of notes
	var name = data[key]["name"];
	var autosave;
	if (data[key]["type"] == "TEXT" || data[key]["type"] == "NOTE") {
		name = name.replace( /<br \/>/gi, "\n");	
	}
	//get the width and height of the element	
	if (data[key]["width"] && data[key]["height"]) {
		var xleft = data[key]["width"]-10;
		var ytop = data[key]["height"]-10;
	} else {
		var xleft = "145px";
		var ytop  = "130px";
	}	
	var copy = $("nametext" + key).clone(true,true);
	copy.cloneEvents($("nametext" + key));
	var textarea = new Element("textarea#namearea" + key, {
					value : name, //.replace(/<[^>]*>?/gm, ''),
					styles : {
						position : "absolute",
						top : "2px",
						"font-size" : "11px",
						"color" : "#666666",
						padding : "5px 10px 10px 10px",
						"background" : "rgba(0, 0, 0, 0)", /* transparent background */
						"resize" : "none",
						width : xleft,
						height : ytop,
						//"overflow-y" : "scroll",
						"font-family" : "arial, sans-serif",
						"border-style" : "none"
					},
					events : {
						click : function(){
							this.focus();
						},
						focus : function() {
							var element = this;
                            autosave = (function() {editElementNameSave(element.get("value"),key);}).periodical(2500);  							
							//autosave = editElementNameSave.periodical(1700, [this.get("value"),key]);
						},
						blur : function() {
							clearInterval(autosave);
							str = editElementNameSave(this.get("value"),key);							
							copy.setProperty("html", str); 
							$("listname" + key).setProperty("html", str);
							copy.replaces(this);
						}					
					}
				}).replaces($("nametext" + key));	
	$("namearea" + key).focus();
}
function editElementNameSave(text, key) {
	if (data[key]["type"] == "TEXT" || data[key]["type"] == "NOTE") {
		text = text.replace( /\n/gi, "<br />");	
	}
	data[key]["name"] = text;
	return text;
}


function deleteElement(key, name) { //deleting the information item
	//delete the element from data with the key
	delete data[key];
	//save the task collection
	databaseSaveTaskCollection(databaseDrawTaskCollection, currentTaskId);
	printOut("Information item " + name + " was successfully deleted.");
}

function checkDateElement(date,key) { //check if the due date is approaching and emphasize the value
	var today = new Date();
	if ((today.diff(date) > -3) && (today.diff(date) < 7)) {
		$("item" + key).setStyle('border','0.2em solid rgba(204, 0, 0, 0.5)');
		//$("msg").innerHTML += "-|" + parseInt(today.diff(date)) + "|-";
		//remove the old date from DOM if it exist
		if (data[key]["width"] && data[key]["height"]) {
			var xleft = ((data[key]["width"]-10)/2-25) + "px";
			var ytop = (data[key]["height"]+1) + "px";
		} else {
			var xleft = "50px";
			if (data[key]["type"] == "NOTE" || data[key]["type"] == "TEXT" || data[key]["type"] == "HTML") {
				var ytop  = "141px";
			} else { 
				var ytop  = "47px";
			}
		}			

		if ($("item" + key).contains($("emphasizedate" + key))) {
			$("emphasizedate" + key).dispose();
		}		
		$("item" + key).adopt(
			new Element("span#emphasizedate" + key, {
				text : date ,
				styles : {
					position : "absolute",
				 	top : ytop,
				 	"font-size" : "11px",
				 	"z-index" : "3",
				 	left : xleft,
				 	color : "rgba(204, 0, 0, 1)"
				} 
			})
		);
	} else {
		$("item" + key).setStyle('border','0.1em solid rgba(112,138,144,0.2)');
		if ($("item" + key).contains($("emphasizedate" + key))) {
			$("emphasizedate" + key).dispose();
		}							
	}
}

/***************************************************************************
Function prints the task name of the currently selected task in the centre 
and title. The function is called:
	- databaseDrawTaskCollection(taskid): when new task is selected and drawn
	- databaseSaveEditTaskName(newName, taskid): when a task name is bing changed and saved
****************************************************************************/
function printTaskNameCentre(taskId) {
	//GET TASK NAME
	currentTaskName = databaseGetTaskName(currentTaskId);
	$("taskName").empty();
	$("taskName").setStyles({
		position : "fixed",
		top : "50%",
		left : "50%",
		"margin-top" : "-60px",
		"margin-left" : "-60px",
		"width" : "120px",
		"height" : "120px",		
		"display" : "table",
		"border-radius" : "120px",
		"background-color" : "rgba(112,138,144,0.6)",
		"z-index" : "-2",
		"text-align" : "center"
	});
	$("taskName").adopt(
			new Element("p#tasknametext", {
				text : currentTaskName,
				styles : {
					position : "relative",
					"font-size" : "14px",
					//margin : "-38px 0px 0 -43px",
					//top : "50%",
					//left : "50%",
					//width : "70%",
					//"text-align" : "center"
					"display" : "table-cell",
  					"vertical-align" : "middle",
  					"text-align" : "center"
				}
			})
		);
	document.title = "TIC - " + currentTaskName;
	drawPICCircles();	
}

/***************************************************************************
Draw importance circles on the page
The function are called:
drawPICCircles(): 
	- window.onresize: when the browser window is resized
	- printTaskNameCentre(taskId): after the name of the task is printed in 
	  the middle of the page the circles are drawn as well
drawCentreDot(): draws the red dot in the centre of the page
	- not used anywhere: for test purposes only
****************************************************************************/
function drawPICCircles(){
	var circleInnitialSize = parseInt(270*(window.innerWidth/1000));
	var topMargin = "50%";
	var topPadding = 10;
	var step = 10;
	$("importanceCircles").empty();
	for(var i = 10; i>5; i--) {
		var marginHalf = circleInnitialSize/2;
		$("importanceCircles").adopt(
			new Element ("div", {
				styles : {				
					position : "fixed",
					"z-index" : "-2",					
					top : topMargin,
					left : "50%",
					margin : "-" + marginHalf + " 0px 0px -" + marginHalf,
					width : circleInnitialSize,
					height : circleInnitialSize,
					border : "1px solid",
					"border-radius" : circleInnitialSize,
					display : "inline",
					"border-color" : "rgba(112,138,144,0.2)"
				}
			})//.adopt(
			//  	new Element ("span", {
			// 		text : "Importance level " + step,			
			//  		styles : {
			//  			"text-align" : "center",
			//  			"float" : "left",
			// 			"font-size" : "11px",					
			// 			"-moz-transform" : "rotate(-44deg)",
			// 			margin : "0 0 0 0",
			// 			padding : topPadding + " 0px 0px " + topPadding,
			// 			"-moz-transform-origin" : "right bottom",
			// 			"color" : "rgba(112,138,144,0.3)"
			//  		}
			//  	})
			// )
		);
		circleInnitialSize = circleInnitialSize + parseInt(135*(window.innerWidth/1000));
		topPadding = topPadding + 17.5;
		step = step-2;
	}
}

function drawCentreDot(){
	//draw a center of a page a red dot (0,0) in coordinate system
	//$("dot").dispose();
	$("body").adopt(
		new Element("div#dot", {
			styles : {
				position : "absolute",
				left : window.innerWidth/2,
				top : window.innerHeight/2,
				width : "5px",
				height : "5px",		
				"border-radius" : "5px",
				"background-color" : "red",
				"z-index" : "10"
			}
		})
	);
}

/***************************************************************************
Draw home, desktop and sticky note in the left top corner
	- window.addEvent('domready': draw them after the DOM is loaded
****************************************************************************/
function drawGeneralIcons(){
	$("generalIcons").setStyles({
		position : 'absolute',
		top : '0px',
		left : '30px'
	})
	$("generalIcons").adopt(
		new Element("div", {
			styles :{
				"float" : "left",
				"width" : "35px",
				"padding-bottom" : "3px",
				"background-color" : "rgba(112,138,144,0.8)",
				"text-align" : "center",
				"-moz-border-radius" : "0px 5px 5px 0px",
				"border-radius" : "0px 0px 5px 5px"		
			}
		}).adopt( 
			new Element("img", {
				title : "Home folder",				
				src : 'images/icons_general/Home.png',
				styles : {
					width : '30px',
					cursor : 'pointer',
				},
				events : {
					click : function(){
						var file = Components.classes["@mozilla.org/file/directory_service;1"].  
								   getService(Components.interfaces.nsIProperties).  
								   get("Home", Components.interfaces.nsIFile);   
						folderOpen(file.path);
					}
				}
			})
		),
		new Element("div", {
			styles :{				
				"float" : "left",
				"width" : "35px",
				"padding-bottom" : "3px",
				"margin-left" : "2px",
				"background-color" : "rgba(112,138,144,0.8)",
				"text-align" : "center",
				"-moz-border-radius" : "0px 5px 5px 0px",
				"border-radius" : "0px 0px 5px 5px"	
			}
		}).adopt(		
			new Element("img", {
				title : "Desktop folder",
				src : 'images/icons_general/Desktop.png',
				styles : {
					width : '30px',
					cursor : 'pointer',
				},			
				events : {
					click : function(){
						var file = Components.classes["@mozilla.org/file/directory_service;1"].  
								   getService(Components.interfaces.nsIProperties).  
								   get("Desk", Components.interfaces.nsIFile);   
						folderOpen(file.path);
					}
				}
			})
		),
		new Element("div", {
			styles :{				
				"float" : "left",
				"width" : "35px",
				"padding-bottom" : "4px",
				"margin-left" : "20px",
				"background-color" : "rgba(112,138,144,0.8)",
				"text-align" : "center",
				"-moz-border-radius" : "0px 5px 5px 0px",
				"border-radius" : "0px 0px 5px 5px"	
			}
		}).adopt(		
			new Element("img", {
				title : "New note",
				src : 'images/icons_content/notes.png',
				styles : {
					width : '30px',
					cursor : 'pointer',
					"margin-top" : "2px"
				},			
				events : {
					click : function(){
						addNewNote();
					}
				}
			})	
		)			
	);
}

/***************************************************************************
Function connects to the database. 
1. If the database file TaskInformationCollection.sqlite exists, it returns 
   the connection
2. If the file does not exist, it creates it, creates tables and enetrs a
   first task in and returns the connection handle
The function is called:
- window.addEvent('domready': after the DOM loades and stores the connection 
  handle to the global variable var connection = databaseConnect(); so the 
  script uses the same handle all the time
****************************************************************************/
function databaseConnect() {
	var dbConn;
	Components.utils.import("resource://gre/modules/Services.jsm"); 
	Components.utils.import("resource://gre/modules/FileUtils.jsm");  
	//ProfD = profile directory https://developer.mozilla.org/en/Code_snippets/File_I%2F%2FO
   	file = FileUtils.getFile("ProfD", ["TaskInformationCollections.sqlite"]); 
   	if (file.exists()) {
   		dbConn = Services.storage.openDatabase(file);
   		printAboutHide();

		//update tables - add task_archived
		var aRows = [];
		var statement = dbConn.createStatement("PRAGMA table_info(tasks)");
		while (statement.executeStep()) {
			aRows.push(statement.row.name);
		}
		statement.finalize(); //$("msg").innerHTML += aRows.toSource()
		if (aRows.contains('task_archived') == false) {
			dbConn.executeSimpleSQL("ALTER TABLE tasks ADD COLUMN task_archived BOOL DEFAULT 0");
		}

        return dbConn;
   	} else {
   		//Will also create the file if it does not exist			
   		dbConn = Services.storage.openDatabase(file);
		//create tables: 
   		dbConn.executeSimpleSQL("CREATE TABLE tasks (task_id INTEGER PRIMARY KEY, task_name TEXT, task_due TEXT, task_share_email TEXT, task_archived BOOL DEFAULT 0)");
   		dbConn.executeSimpleSQL("CREATE TABLE tasks_last (last_id INTEGER PRIMARY KEY, last_task INTEGER)");
   		dbConn.executeSimpleSQL("CREATE TABLE tasks_collections (coll_id INTEGER PRIMARY KEY, task_id INTEGER, coll_timestamp TEXT, coll_items TEXT)");
   		dbConn.executeSimpleSQL("CREATE INDEX collections_task_id ON tasks_collections (coll_id DESC, task_id DESC)");
   		dbConn.executeSimpleSQL("INSERT INTO tasks (task_id, task_name) VALUES('1', 'My first task')");
   		dbConn.executeSimpleSQL("INSERT INTO tasks_last (last_id, last_task) VALUES('1','1')");
   		dbConn.executeSimpleSQL("CREATE TABLE user (data_id INTEGER PRIMARY KEY, data_userid TEXT, data_last_sent TEXT, data_last_mantained TEXT, data_user_email TEXT, data_user_password TEXT)");
   		//Create an unique id for the user and set the date to the current one ... so we can send the dump
   		//of the database every 7 days ... if the user agrees
		var statement = dbConn.createStatement("INSERT INTO user (data_id, data_userid, data_last_sent, data_last_mantained) VALUES(1, :uid, :date1, :date2)");
		var currentTime = new Date().format('db');
		statement.params.uid = (Number.random(100, 999) + currentTime).toMD5();			
		statement.params.date1 = currentTime;
		statement.params.date2 = currentTime;
		//MOZ_STORAGE_STATEMENT_READY 	1 	The SQL statement is ready to be executed.
		if (statement.state == 1) { 
			//synchronus ... we can't do anything before the DB is set up
			statement.execute();
			statement.finalize();
			// connection.executeAsync([statement], 1,  {
			// 	handleCompletion : function(aReason) {
			// 		if (aReason != Components.interfaces.mozIStorageStatementCallback.REASON_FINISHED) {  
			// 				printOut("Query canceled or aborted!");
			// 		}
			// 		statement.finalize();
			// 	},
			// 	handleError : function(aError) {printOut(aError.message);},
			// 	handleResult : function(aResultSet) {}
			// }); 
		} else {
			printOut("Not a valid SQL statement: INSERT INTO data (data_userid, data_last_sent) VALUES(:uid, :date)");
		}	
		printAboutShow();
		printOutHide();
   		return dbConn;
   	}
}

/***************************************************************************
STORE and GET last selected task
The function are called:
databaseGetLastTask() 
	- window.addEvent('domready': when the DOM is ready 
	  currentTaskId = databaseGetLastTask();
databaseSetLastTask()
    - databaseDrawTaskCollection(taskid): when a new task is selected
	- databaseDeleteTask(taskid,name): when the task is deleted it sets the 
	  last task to the current one
	- (function() { databaseSetLastTask() }).periodical(180000);
	  saves the current task Id to the last viewed task
****************************************************************************/
function databaseGetLastTask() {
	//select from DB
	var statement = connection.createStatement("SELECT * FROM tasks_last WHERE last_id = 1"); 
	//MOZ_STORAGE_STATEMENT_READY 	1 	The SQL statement is ready to be executed.
	if (statement.state == 1) {	
		statement.executeStep();
		curtask = statement.row.last_task;
		statement.finalize();
	} else {
		printOut("Not a valid SQL statement: SELECT * FROM tasks_last WHERE last_id = 1");
	}	
	return curtask;
}

function databaseSetLastTask() {
	var statement = connection.createStatement("UPDATE tasks_last SET last_task = :lata WHERE last_id = 1");
	statement.params.lata = currentTaskId;
	//MOZ_STORAGE_STATEMENT_READY 	1 	The SQL statement is ready to be executed.
	if (statement.state == 1) { 
		//statement.executeStep();
		connection.executeAsync([statement], 1,  {
			handleCompletion : function(aReason) {
				if (aReason != Components.interfaces.mozIStorageStatementCallback.REASON_FINISHED) {  
						printOut("Query canceled or aborted!");
				} else {
					//printOut(aReason.message);
				}
				statement.finalize();
			},
			handleError : function(aError) {printOut(aError.message);},
			handleResult : function(aResultSet) {}
		}); 
	} else {
		printOut("Not a valid SQL statement: UPDATE tasks_last SET last_task = :lt WHERE last_id = '1'");
	}		
}

/***************************************************************************
Database backup and maintenance
The function are called:
databaseDump() Send the dump of the database to the server if set in preferences 
	- (function() { databaseDump() }).periodical(3600000): starts it every hour
sendJSON(userid,dbdump): sends the JSON of the DB dump to the server
	- databaseDump(): when the dump is ready
databaseMaintenance(): performs vacuum and reindexing once a month based on the value
    stored in the DB table user
	- (function() { databaseMaintenance() }).periodical(3600000): runs every hour
compareAndCleanStages(): see beow detailed description 
	- databaseMaintenance(): before the reindex and vacuuming
****************************************************************************/
function databaseDump() {
	//get the preference of shared4research2 value and send data only if it is yes == 2
	var prefs = Components.classes["@mozilla.org/preferences-service;1"]
	                      .getService(Components.interfaces.nsIPrefService);
	var branch = prefs.getBranch("extensions.tic.");
	var share4research2 = branch.getIntPref("share4research2");

	if (share4research2 == 2) {		
	    var dumpText = "";
		//Get the userid and last date the db was dumped and sent over
		var statement = connection.createStatement("SELECT * FROM user");	
		//MOZ_STORAGE_STATEMENT_READY 	1 	The SQL statement is ready to be executed.
		if (statement.state == 1) {
			var userId = "";
			var dateLastDumped = "";
			var dataSentSuccessful = "";
			while (statement.executeStep()) { 
				userId = statement.row.data_userid;
				dateLastDumped = statement.row.data_last_sent;
			}
			statement.finalize(); 
		} else {
			printOut("Not a valid SQL statement: SELECT * FROM user");
			return false;
		}
		//dump the db if userId and datelastdumped are not empty
		if (userId != "" && dateLastDumped != "") {
			var today = new Date();	
			var lastDumped = new Date().parse(dateLastDumped);	
			var difference = today.diff(lastDumped);
			if (difference <= -6){
				var statement = connection.createStatement("SELECT * FROM tasks");	
				//MOZ_STORAGE_STATEMENT_READY 	1 	The SQL statement is ready to be executed.
				if (statement.state == 1) {
					dumpText += "DROP TABLE IF EXISTS \"tasks\"";
					dumpText += "CREATE TABLE tasks (task_id INTEGER PRIMARY KEY, task_name TEXT, task_due TEXT)";
					while (statement.executeStep()) { 
						dumpText += "INSERT INTO \"tasks\" VALUES(" + statement.row.task_id + ",'" + statement.row.task_name.replace("'", "''", "g") + "','" + statement.row.task_due + "');\n"; 			
					}
					statement.finalize(); 
				} else {
					printOut("Not a valid SQL statement: SELECT * FROM tasks");
					return false;
				}			
				var statement = connection.createStatement("SELECT * FROM tasks_collections");	
				//MOZ_STORAGE_STATEMENT_READY 	1 	The SQL statement is ready to be executed.
				if (statement.state == 1) {
					dumpText += "DROP TABLE IF EXISTS \"tasks_collections\"";
					dumpText += "CREATE TABLE tasks_collections (coll_id INTEGER PRIMARY KEY, task_id , coll_timestamp TEXT, coll_items TEXT)";
					while (statement.executeStep()) { 
						dumpText += "INSERT INTO \"tasks_collections\" VALUES(" + statement.row.coll_id + "," + statement.row.task_id + ",'" + statement.row.coll_timestamp + "','" + statement.row.coll_items.replace("'", "''", "g") + "');\n";					
					}
					statement.finalize(); 
				} else {
					printOut("Not a valid SQL statement: SELECT * FROM tasks_collections");
					return false;
				}
				//DROP TABLE IF EXISTS "tasks_last";
				//CREATE TABLE tasks_last (last_id INTEGER PRIMARY KEY, last_task INTEGER);
				//DROP TABLE IF EXISTS "data";
				//CREATE TABLE data (data_userid TEXT PRIMARY KEY  NOT NULL, data_last_sent TEXT);

				//var dataToBeSentJSON = JSON.encode(dataToBeSent);
	    		sendJSON(userId,dumpText);
			}
		} else {
			//create userId != "" && dateLastDumped != ""
			var statement = connection.createStatement("INSERT INTO user (data_id, data_userid, data_last_sent) VALUES(1, :tid, :tdate)");
			var currentTime = new Date().format('db');
			statement.params.tdate = new Date().decrement('day', 7).format('db');
			statement.params.tid = (Number.random(100, 999) + currentTime).toMD5();
			//MOZ_STORAGE_STATEMENT_READY 	1 	The SQL statement is ready to be executed.
			if (statement.state == 1) { 
				connection.executeAsync([statement], 1,  {
					handleCompletion : function(aReason) {
						if (aReason != Components.interfaces.mozIStorageStatementCallback.REASON_FINISHED) {  
								printOut("Query canceled or aborted!");
						}	
						statement.finalize();
					},
					handleError : function(aError) {printOut(aError.message);},
					handleResult : function() {}
				}); 
			} else {
				printOut("Not a valid SQL statement: INSERT INTO user (data_id, data_userid, data_last_sent) VALUES(1,:uid, :date)");
			}
		}
		/* //Write dump to a file 01.sql in the profile folder for testing purposes
			Components.utils.import("resource://gre/modules/Services.jsm"); 
			Components.utils.import("resource://gre/modules/FileUtils.jsm");  
			//ProfD = profile directory https://developer.mozilla.org/en/Code_snippets/File_I%2F%2FO
		   	file = FileUtils.getFile("ProfD", ["01.sql"]); 
		    // file is nsIFile, data is a string  
		    var foStream = Components.classes["@mozilla.org/network/file-output-stream;1"].  
		                             createInstance(Components.interfaces.nsIFileOutputStream);  
		    // use 0x02 | 0x10 to open file for appending.  
		    foStream.init(file, 0x02 | 0x08 | 0x20, 0666, 0);   
		    // write, create, truncate  
		    // In a c file operation, we have no need to set file mode with or operation,  
		    // directly using "r" or "w" usually.  
		    // if you are sure there will never ever be any non-ascii text in data you can   
		    // also call foStream.writeData directly  
		    var converter = Components.classes["@mozilla.org/intl/converter-output-stream;1"].  
		                             createInstance(Components.interfaces.nsIConverterOutputStream);  
		    converter.init(foStream, "UTF-8", 0, 0);  
		    converter.writeString(dumpText);  
		    converter.close(); // this closes foStream  
		*/
	} //do the above only if it is selected in preference to dump the DB and send it over for research
}

function sendJSON(userid,dbdump) {

	var compressed_dbdump = dbdump; //lzw_encode(dbdump);
	var data = {
		'userId': userid, 
 		'db': compressed_dbdump
	};

 	var myRequest = new Request.JSON({
 		url : 'https://pim.famnit.upr.si/tic/receiveit.php',
 		onComplete : function(){ 			
 			var statement = connection.createStatement("UPDATE user SET data_last_sent = :date WHERE data_userid = :uid");
			statement.params.date = new Date().format('db');
			statement.params.uid = userid
			//MOZ_STORAGE_STATEMENT_READY 1 The SQL statement is ready to be executed.
			if (statement.state == 1) { 
				//statement.executeStep(); //<--- synchronus ... 
				connection.executeAsync([statement], 1,  {
					handleCompletion : function(aReason) {
						if (aReason != Components.interfaces.mozIStorageStatementCallback.REASON_FINISHED) {  
							printOut("Query canceled or aborted!");
						} else {
							//printOut(aReason.message);
						}
						statement.finalize();
					},
					handleError : function(aError) {printOut(aError.message);},
					handleResult : function(aResultSet) {}
				}); 
			} else {
				printOut("Not a valid SQL statement: UPDATE user SET data_last_sent = :date WHERE data_userid = :uid");
			}
 		}
 	}).post(data);
}

//vacuum db & reindex 
function databaseMaintenance() {
	//do maintenance once a month ... based on the date of the last dump
	//Get the userid and last date the db was dumped and sent over
	var statement = connection.createStatement("SELECT * FROM user");	
	//MOZ_STORAGE_STATEMENT_READY 	1 	The SQL statement is ready to be executed.
	if (statement.state == 1) {
		var dateLastMaintained = "";
		statement.executeStep();
		dateLastMaintained = statement.row.data_last_mantained;
		statement.finalize(); 

		if (dateLastMaintained == "") {
			dateLastMaintained == new Date().decrement('day', -31).format('db');
		}	

		var today = new Date();	
		var lastMaintained = new Date().parse(dateLastMaintained);	
		var difference = today.diff(lastMaintained);
		if (difference <= -30){
			//delete old tasks+ states than are not significanly different (coordinates, size, modification time)
			compareAndCleanStages();
			//we need to redraw the current task so the old stages are updated if some are deleted
			databaseDrawTaskCollection(currentTaskId);

			//reindex the indexes
			var statement = connection.createStatement("REINDEX collections_task_id");	
			//MOZ_STORAGE_STATEMENT_READY 	1 	The SQL statement is ready to be executed.
			if (statement.state == 1) {
				connection.executeAsync([statement], 1,  {
					handleCompletion : function(aReason) {
						if (aReason != Components.interfaces.mozIStorageStatementCallback.REASON_FINISHED) {  
								printOut("Query canceled or aborted!");
						} else {
							//printOut(aReason.message);
						}	
						statement.finalize();
					},
					handleError : function(aError) {printOut(aError.message);},
					handleResult : function() {}
				}); 
			} else {
				printOut("Not a valid SQL statement: REINDEX collections_task_id");
				return false;
			}

			//Compact & cleanup
			var statement = connection.createStatement("VACUUM");	
			//MOZ_STORAGE_STATEMENT_READY 	1 	The SQL statement is ready to be executed.
			if (statement.state == 1) {
				connection.executeAsync([statement], 1,  {
					handleCompletion : function(aReason) {
						if (aReason != Components.interfaces.mozIStorageStatementCallback.REASON_FINISHED) {  
								printOut("Query canceled or aborted!");
						} else {
							//printOut(aReason.message);
						}	
						statement.finalize();
					},
					handleError : function(aError) {printOut(aError.message);},
					handleResult : function() {}
				}); 
			} else {
				printOut("Not a valid SQL statement: VACUUM");
				return false;
			}			

			//update date in the user table
 			var statement = connection.createStatement("UPDATE user SET data_last_mantained = :date WHERE data_id = 1");
			statement.params.date = new Date().format('db');	
			//MOZ_STORAGE_STATEMENT_READY 	1 	The SQL statement is ready to be executed.
			if (statement.state == 1) {
				connection.executeAsync([statement], 1,  {
					handleCompletion : function(aReason) {
						if (aReason != Components.interfaces.mozIStorageStatementCallback.REASON_FINISHED) {  
								printOut("Query canceled or aborted!");
						} else {
							//printOut(aReason.message);
						}	
						statement.finalize();
					},
					handleError : function(aError) {printOut(aError.message);},
					handleResult : function() {}
				}); 
			} else {
				printOut("Not a valid SQL statement: UPDATE user SET data_last_mantained = :date WHERE data_id = 1");
				return false;
			}					

		}
	} else {
		printOut("Not a valid SQL statement: SELECT * FROM user");
		return false;
	}
}

//if the DB grows too big delete our rows from tasks_collections that have no significant changes
//compare all consequent states of a task and delete based on compareDataObjectXYZ function
//if two consequent stages differ only in certain tags(s) it deletes the oldes one
function compareAndCleanStages(){
	var tasksArray = [];
	var statement = connection.createStatement("SELECT * FROM tasks ORDER BY task_id DESC");  
	//MOZ_STORAGE_STATEMENT_READY 	1 	The SQL statement is ready to be executed.
	if (statement.state == 1) { 
		while (statement.executeStep()) { 
			tasksArray.append([statement.row.task_id]);
		}
	}
	statement.finalize();

	//traverse through all tasks
	for (var j = 0; j < tasksArray.length; j++ ) {
		var statement = connection.createStatement("SELECT COUNT(*) AS l FROM tasks_collections WHERE task_id = :tid");		
		statement.params.tid = tasksArray[j];
		//MOZ_STORAGE_STATEMENT_READY 	1 	The SQL statement is ready to be executed.
		if (statement.state == 1) {
			//need to execute just once to count the # of task states (all collections)
			statement.executeStep();
			var numOfCols = parseInt(statement.row.l);
			statement.finalize();
			//do a clean-up only if there are more than 5 old states
            if (numOfCols > 5) { 
				var statement = connection.createStatement("SELECT * FROM tasks_collections WHERE task_id=:tid ORDER BY coll_id ASC");
				statement.params.tid = tasksArray[j];
				//MOZ_STORAGE_STATEMENT_READY 	1 	The SQL statement is ready to be executed.
				if (statement.state == 1) {
					var tmpArray = [];
					statement.executeStep();
					var obj1 = JSON.decode(statement.row.coll_items);
					var tmpId1 = statement.row.coll_id;
					statement.executeStep();
					var obj2 = JSON.decode(statement.row.coll_items);
					var tmpId2 = statement.row.coll_id; 
					if (compareDataObjectCoordinates(obj1, obj2) != false || compareDataObjectSizeMod(obj1, obj2) != false) {
						tmpArray.append([tmpId1]);
					}
					while (statement.executeStep()) {
						obj1 = obj2;
						tmpId1 = tmpId2;
						obj2 = JSON.decode(statement.row.coll_items);
						tmpId2 = statement.row.coll_id;
						if (compareDataObjectCoordinates(obj1, obj2) != false || compareDataObjectSizeMod(obj1, obj2) != false) {
							tmpArray.append([tmpId1]);
						}
					}
					statement.finalize(); 	
				} else {
					printOut("Not a valid SQL statement: INSERT INTO tasks (task_name) VALUES(:tn)");
				}

				for (var i=0; i < tmpArray.length; i++) {
					//$("msg").innerHTML += " -" + tmpArray[i] + "- ";
					databaseDeleteTaskStage(tmpArray[i]);
				}
			}
		}
	}
}

/***************************************************************************
Functions print out the list of all available tasks from the database to the 
side panel. The function is called:
databaseShowTasks()
	- window.addEvent('domready',: when the DOM loads
	- databaseSaveEditTaskName(newName, taskid): when a task name is changed 
	- databaseEnterNewTask(): when new task is entered
	- databaseDeleteTask(taskid,name): when a task is deleted
databaseShowArchivedTasks()	
	- window.addEvent('domready',: when the DOM loads
	- databaseSaveEditTaskName(newName, taskid): when a task name is changed 
	- databaseDeleteTask(taskid,name): when a task is deleted
****************************************************************************/
function databaseShowTasks() {	   	  
	//clear the tasks from DOM
	$("tasksList").empty(); 
	//select from DB
	var statement = connection.createStatement("SELECT * FROM tasks WHERE task_archived=0 ORDER BY task_id DESC");  
	//MOZ_STORAGE_STATEMENT_READY 	1 	The SQL statement is ready to be executed.
	if (statement.state == 1) { 
		while (statement.executeStep()) { 
			(function(){  
				var taskname = statement.row.task_name;
				var taskid = statement.row.task_id;
				$("tasksList").adopt(
					new Element ("div#task" + taskid, {
						styles : {
							width : "195",
							display : "block"//,
							//"padding-bottom" : "2px",
							//"font-size" : "14px",
							//"border-bottom" : "1px solid",
							//"border-color" : "rgba(112,138,144,0.8)"
						}
					})				
				);	
				$("task" + taskid).adopt( 
					    new Element("a", {
							"id" : "taskIdCircle" + taskid,
							"href" : "#" + taskname,
							 "text" : taskid,
							styles : {
								//position : "absolute",
								//left : leftStep + "px",
								//top : "-20px",
								float : "left",
								width : "20px",
								height : "20px",	
								"font-size" : "11px",
								"line-height" : "20px",
								display : "block",
								"border-radius" : "20px",
								"background-color" : "#C0C0C0",
								"text-align" : "center"
							},
							events : {
								click : function(){
									databaseSaveTaskCollection(databaseDrawTaskCollection, taskid);
									return false;									
								}
							}				    	
					    }),
						new Element("span", {
							"html" : "&nbsp;",
							styles : {
								float : "left",
								width : "3px" 
							}							
						}),					    
						new Element("a", {
							"id" : "taskName" + taskid,
							"href" : "#" + taskname,
							"html" : taskname,
							styles : {
								float : "left", 
								width : "121"							
							},
							events : {
								click : function(){
									databaseSaveTaskCollection(databaseDrawTaskCollection, taskid);
									return false;
								}
							}
						}),
						new Element("img", {
							"src" : "images/icons_general/Prorgrams.png",
							"id" : "taskEdit" + taskid,
							"alt" : "Edit",
							"title" : "Edit task name",
							"width" : "17px",
							"height" : "20px",
							styles : {
								float : "left",
								cursor : "pointer"								
							},
							events : {
								click : function(){
									//call function that replaces the above a with input
									changeEditTaskName(taskid);
								}
							}							
						}),
						new Element("img", {
							"src" : "images/icons_general/RecycleBin_Empty.png",
							"id" : "taskDelete" + taskid,
							"alt" : "Delete",
							"title" : "Remove task",
							"width" : "17px",
							"height" : "20px",							
							styles : {
								float : "left",
								cursor : "pointer"								
							},
							events : {
								click : function(){
									//fire up the confirmation box
									var question = confirm("PERMANENTLY delete the task " + taskname + "?")
									if (question == true){
										databaseDeleteTask(taskid,taskname);
									} else {
										//alert("?");
									}
									
								}
							}							
						}),
						new Element("img", {
							"src" : "images/icons_general/file_cabinet_closed.png",
							"id" : "taskArchive" + taskid,
							"alt" : "Archive",
							"title" : "Archive",
							"width" : "17px",
							"height" : "20px",							
							styles : {
								float : "left",
								cursor : "pointer"								
							},
							events : {
								click : function(){
									databaseArchiveTask(taskid, taskname);
								}
							}							
						}),						
						new Element("div", {						
							styles : {
								"clear" : "both",
								"border-style" : "solid",
								"border-width" : "1px 0px 0px 0px",
								"border-color" : "#98AFC7",
								width : "195px"
							}							
						})

				);
			})();
		} 
		statement.finalize();
	} else {
		printOut("Not a valid SQL statement: SELECT * FROM tasks ORDER BY task_id DESC");
	}				
}

function databaseShowArchivedTasks() {	   	  
	//clear the tasks from DOM
	$("tasksListArchived").empty(); 
	//select from DB
	var statement = connection.createStatement("SELECT * FROM tasks WHERE task_archived=1 ORDER BY task_id DESC");  
	//MOZ_STORAGE_STATEMENT_READY 	1 	The SQL statement is ready to be executed.

	if (statement.state == 1) { 
		while (statement.executeStep()) { 
			(function(){  
				var taskname = statement.row.task_name;
				var taskid = statement.row.task_id;
				$("tasksListArchived").adopt(
					new Element ("div#task" + taskid, {
						styles : {
							width : "195",
							display : "block"//,
							//"padding-bottom" : "2px",
							//"font-size" : "14px",
							//"border-bottom" : "1px solid",
							//"border-color" : "rgba(112,138,144,0.8)"
						}
					})				
				);	
				$("task" + taskid).adopt( 
					    new Element("a", {
							"id" : "taskIdCircle" + taskid,
							"href" : "#" + taskname,
							 "text" : taskid,
							styles : {
								//position : "absolute",
								//left : leftStep + "px",
								//top : "-20px",
								float : "left",
								width : "20px",
								height : "20px",	
								"font-size" : "11px",
								"line-height" : "20px",
								display : "block",
								"border-radius" : "20px",
								"background-color" : "#C0C0C0",
								"text-align" : "center"
							},
							events : {
								click : function(){
									databaseSaveTaskCollection(databaseDrawTaskCollection, taskid);
									return false;									
								}
							}				    	
					    }),
						new Element("span", {
							"html" : "&nbsp;",
							styles : {
								float : "left",
								width : "3px" 
							}							
						}),					    
						new Element("a", {
							"id" : "taskName" + taskid,
							"href" : "#" + taskname,
							"html" : taskname,
							styles : {
								float : "left", 
								width : "121"							
							},
							events : {
								click : function(){
									databaseSaveTaskCollection(databaseDrawTaskCollection, taskid);
									return false;
								}
							}
						}),
						new Element("img", {
							"src" : "images/icons_general/Prorgrams.png",
							"id" : "taskEdit" + taskid,
							"alt" : "Edit",
							"title" : "Edit task name",
							"width" : "17px",
							"height" : "20px",
							styles : {
								float : "left",
								cursor : "pointer"								
							},
							events : {
								click : function(){
									//call function that replaces the above a with input
									changeEditTaskName(taskid);
								}
							}							
						}),
						new Element("img", {
							"src" : "images/icons_general/RecycleBin_Empty.png",
							"id" : "taskDelete" + taskid,
							"alt" : "Delete",
							"title" : "Remove task",
							"width" : "17px",
							"height" : "20px",							
							styles : {
								float : "left",
								cursor : "pointer"								
							},
							events : {
								click : function(){
									//fire up the confirmation box
									var question = confirm("PERMANENTLY delete the task " + taskname + "?")
									if (question == true){
										databaseDeleteTask(taskid,taskname);
									} else {
										//alert("?");
									}
									
								}
							}							
						}),
						new Element("img", {
							"src" : "images/icons_general/file_cabinet_opened.png",
							"id" : "taskArchive" + taskid,
							"alt" : "Retrieve",
							"title" : "Retrieve",
							"width" : "17px",
							"height" : "20px",							
							styles : {
								float : "left",
								cursor : "pointer"								
							},
							events : {
								click : function(){
									databaseRetrieveTask(taskid,taskname);
								}
							}							
						}),						
						new Element("div", {						
							styles : {
								"clear" : "both",
								"border-style" : "solid",
								"border-width" : "1px 0px 0px 0px",
								"border-color" : "#98AFC7",
								width : "195px"
							}							
						})

				);
			})();
		} 
		statement.finalize();
	} else {
		printOut("Not a valid SQL statement: SELECT * FROM tasks ORDER BY task_id DESC");
	}		
}

/***************************************************************************
Function gets the task name from the task id. The function is called:
	- drawTICElements(): when overlapping tasks to show a name if mouseovered 
	  the overlapping number in a circle above the item icon
	- drawTICElementsPastStates(pastStatesId): the same as above
	- printTaskNameCentre(taskId): to print a name in the centre of the page
****************************************************************************/
function databaseGetTaskName(taskId) {
	//GET TASK NAME
	var statement = connection.createStatement("SELECT * FROM tasks WHERE task_id = :tid");	
	statement.params.tid = taskId;
	//MOZ_STORAGE_STATEMENT_READY 	1 	The SQL statement is ready to be executed.
	if (statement.state == 1) {
		/*connection.executeAsync([statement], 1,  {
			handleResult : function(aResultSet) {
				var row;
			    while(row = aResultSet.getNextRow()) {  			  
			      	taskname = row.getResultByName("task_name");
			    } 
			},			
			handleCompletion : function(aReason) {
				 if (aReason != Components.interfaces.mozIStorageStatementCallback.REASON_FINISHED) {  
				 		printOut("Query canceled or aborted!");
				 } 
			    $("msg").innerHTML += "----" + taskname;
	   			return taskname;				
			},
			handleError : function(aError) {printOut(aError.message);}

		}); */
		var taskname; 
		while (statement.executeStep()) { 
			taskname = statement.row.task_name;
		}
		statement.finalize(); 
		return taskname;
	} else {
		printOut("Not a valid SQL statement: SELECT * FROM tasks WHERE task_id = :tid");
		return false;
	}	
}

/***************************************************************************
Changes and saves the task name text. Changing creates a form field around
the task name and creates a save button 
The functiona re called :
changeEditTaskName(taskid) 
	- databaseShowTasks(): append to the button edit besides task name in a side panel
databaseSaveEditTaskName(newName, taskid)	
	- changeEditTaskName(taskid): append to the Save button when the name is edited
****************************************************************************/
function changeEditTaskName(taskid){
	var taskText = $("taskName" + taskid).get('text');
	//printOut(text);
	var input = new Element("input", {
			"id" : "taskInput" + taskid,
			"type": "text",
			"value" : taskText
		}).replaces($("taskName" + taskid));
	var button = new Element("button", {
			"id" : "taskSave" + taskid,
			"text" : "Save",
			events : {
				click : function(){
					//call function that saves the changed text
					databaseSaveEditTaskName($("taskInput" + taskid).get('value'), taskid);
				}
			}							
		}).replaces($("taskEdit" + taskid))
}

function databaseSaveEditTaskName(newName, taskid) {
	var statement = connection.createStatement("UPDATE tasks SET task_name = :tn WHERE task_id= :tid");
	statement.params.tn = newName;
	statement.params.tid = taskid;
	//MOZ_STORAGE_STATEMENT_READY 	1 	The SQL statement is ready to be executed.
	if (statement.state == 1) { 
		connection.executeAsync([statement], 1,  {
			handleCompletion : function(aReason) {
				if (aReason != Components.interfaces.mozIStorageStatementCallback.REASON_FINISHED) {  
						printOut("Query canceled or aborted!");
				} else {
					//printOut(aReason.message);
				}	
				statement.finalize();
				databaseShowTasks();
				databaseShowArchivedTasks();
				if (taskid == currentTaskId) { 
					printTaskNameCentre(taskid);
					drawTICElements();
				}
			},
			handleError : function(aError) {printOut(aError.message);},
			handleResult : function() {}
		}); 
	} else {
		printOut("Not a valid SQL statement: UPDATE tasks SET task_name = :tn WHERE task_id= :tid");
	}	
}

/***************************************************************************
Function to delete the whole task or just a particular stage of the task
The functiona are called:
databaseDeleteTask(taskid,name): deletes the task and all the associated collections
	- databaseShowTasks(): append to the button bedised task name in the side panel
databaseDeleteTaskStage(coll_id): deletes just one stage of a task
	- databaseSaveTaskCollection (callback, param): if the new task stage and the 
	  last one in the DB are differenc sheck if they differ in file sizes and mod 
	  times onyl and if the d delete the one in the DB
	- compareAndCleanStages(): compares two consequest stages of every task and
	  if they don't significantly differ (e.g. only coordinates) the older one is deleted
databaseArchiveTask(taskid, name): Moves a task to archived
	- databaseShowTasks(): called when user sclicks on the icon
databaseRetrieveTask(taskid, name): retrieves task back to tasklist
	- databaseShowArchivedTasks(): called when user sclicks on the icon
****************************************************************************/
function databaseDeleteTask(taskid,name){
	var statement1 = connection.createStatement("DELETE FROM tasks_collections WHERE task_id= :tid");
	statement1.params.tid = taskid;
	var statement2 = connection.createStatement("DELETE FROM tasks WHERE task_id= :tid");
	statement2.params.tid = taskid;
	//MOZ_STORAGE_STATEMENT_READY 	1 	The SQL statement is ready to be executed.
	if (statement1.state == 1 && statement2.state == 1) { 
		connection.executeAsync([statement1, statement2], 2,  {
			handleCompletion : function(aReason) {
				if (aReason != Components.interfaces.mozIStorageStatementCallback.REASON_FINISHED) {  
						printOut("Query canceled or aborted!");
				} else {
					//printOut(aReason.message);
				}	
			},
			handleError : function(aError) {printOut(aError.message);},
			handleResult : function() {}
		}); 
		statement1.finalize();
		statement2.finalize();
		databaseShowTasks();
		databaseShowArchivedTasks();
		printOut("Task \"" + name + "\" was successfully deleted!");
	} else {
		printOut("Not valid SQL statements: DELETE FROM tasks...");
	}
	//if the current task is the one that has just been deleted change it to the last one in the DB
	if (currentTaskId == taskid) {
		//var statement = connection.createStatement("SELECT last_insert_rowid() AS lid FROM tasks");
		var statement = connection.createStatement("SELECT * FROM tasks ORDER BY task_id DESC");
		//MOZ_STORAGE_STATEMENT_READY 	1 	The SQL statement is ready to be executed.
		if (statement.state == 1) {
			statement.executeStep();
			currentTaskId = statement.row.task_id;
			statement.finalize();
			databaseSetLastTask();
			databaseDrawTaskCollection(currentTaskId);
		} else {
			printOut("Not a valid SQL statement: SELECT last_insert_rowid() FROM tasks");
		}	
	}	
}

function databaseDeleteTaskStage(coll_id){
	var statement = connection.createStatement("DELETE FROM tasks_collections WHERE coll_id= :cid");
	statement.params.cid = coll_id;
	//MOZ_STORAGE_STATEMENT_READY 	1 	The SQL statement is ready to be executed.
	if (statement.state == 1) { 
		statement.executeStep();
	} else {
		printOut("Not valid SQL statements: DELETE FROM tasks...");
	}	
}

function databaseArchiveTask(taskid, name) {
	var statement = connection.createStatement("UPDATE tasks SET task_archived=1 WHERE  task_id= :tid");
	statement.params.tid = taskid;
	//MOZ_STORAGE_STATEMENT_READY 	1 	The SQL statement is ready to be executed.
	if (statement.state == 1) { 
		connection.executeAsync([statement], 1,  {
			handleCompletion : function(aReason) {
				if (aReason != Components.interfaces.mozIStorageStatementCallback.REASON_FINISHED) {  
						printOut("Query canceled or aborted!");
				} else {
					//printOut(aReason.message);
				}	
			},
			handleError : function(aError) {printOut(aError.message);},
			handleResult : function() {}
		}); 
		statement.finalize();
		databaseShowTasks();
		databaseShowArchivedTasks();
		printOut("Task \"" + name + "\" was archived to Archive!");
	} else {
		printOut("Not valid SQL statements: DELETE FROM tasks...");
	}

}

function databaseRetrieveTask(taskid, name) {
	var statement = connection.createStatement("UPDATE tasks SET task_archived=0 WHERE  task_id= :tid");
	statement.params.tid = taskid;
	//MOZ_STORAGE_STATEMENT_READY 	1 	The SQL statement is ready to be executed.
	if (statement.state == 1) { 
		connection.executeAsync([statement], 1,  {
			handleCompletion : function(aReason) {
				if (aReason != Components.interfaces.mozIStorageStatementCallback.REASON_FINISHED) {  
						printOut("Query canceled or aborted!");
				} else {
					//printOut(aReason.message);
				}	
			},
			handleError : function(aError) {printOut(aError.message);},
			handleResult : function() {}
		}); 
		statement.finalize();
		databaseShowTasks();
		databaseShowArchivedTasks();
		printOut("Task \"" + name + "\" was retrieved back to Projects/Tasks!");
	} else {
		printOut("Not valid SQL statements: DELETE FROM tasks...");
	}
}

/***************************************************************************
Function draws all information items of a selected task from the side panel
It sets the global variable currentTaskId to the received taskid
It gets all the rows (states) of the selected task, it orders them by timestamp, 
prints out the first (last entered one) and adds the rest to the timeline on the side
The function is called:
	- window.addEvent('domready': when the page loads
	- databaseShowTasks() append to the task names in the side panel
	- databaseSaveTaskCollection(databaseDrawTaskCollection, currentTaskId): as 
	  a callback parameter whenever the task is saved
****************************************************************************/
function databaseDrawTaskCollection(taskid) {
	//remove the messages div before drawing the next collection
	$("printText").addClass("hidden");
	currentTaskId = taskid;
	//databaseSetLastTask(); 	  
	//count the number of results
	//var statement = connection.createStatement("SELECT task_id, coll_timestamp, coll_items, COUNT(*) AS l FROM tasks_collections WHERE task_id = :tid ORDER BY coll_id DESC");	
	var statement = connection.createStatement("SELECT COUNT(*) AS l FROM tasks_collections WHERE task_id = :tid");		
	statement.params.tid = currentTaskId;
	//MOZ_STORAGE_STATEMENT_READY 	1 	The SQL statement is ready to be executed.
	if (statement.state == 1) {
		//need to execute just once to count the # of task states (all collections)
		statement.executeStep();
		var numOfCols = parseInt(statement.row.l);
		statement.finalize();

		/*************** ROWS OF THIS TASK IS 0 not past tasks no data**********/
		if (numOfCols == 0){
			//clear the object data if there is smthng in from a previous task
			emptyObject(data);
			$("timelineSlideoutInner").empty();
			$("timelineSlideoutInner").adopt(
				new Element ("div#timelineInfo", {
					styles : {
						width : "210px",
						"font-size" : "14px"
					}
				})
			);
			$("timelineInfo").adopt(
				new Element("a", {
					html : "Current state",
					href : "#currentstate",
					styles : {
						cursor: "pointer"
					},							
					events : {
						click : function(){
							drawTICElements(); //return false;
						}
					}
				})
			);
			$("timelineInfo").adopt(new Element("br"));
			$("timelineInfo").adopt(
				new Element("span", {
					html: "Past states (0)"
				})
			);				
		/*************** ROWS MORE THAN 0 **********/
		} else {
			var statement = connection.createStatement("SELECT * FROM tasks_collections WHERE task_id = :tid ORDER BY coll_id DESC");	
			statement.params.tid = currentTaskId;
			//MOZ_STORAGE_STATEMENT_READY 	1 	The SQL statement is ready to be executed.
			if (statement.state == 1) {
				//there are mor than 0 records so we can make the executeStep() to fill the variable data
				statement.executeStep();
				data = JSON.decode(statement.row.coll_items);

				/*************** ROWS FOR THIS TASK IS 1 just data and no past tasks **********/
				if (numOfCols == 1) {					
					$("timelineSlideoutInner").empty();
					$("timelineSlideoutInner").adopt(
						new Element ("div#timelineInfo", {
							styles : {
								width : "210px",
								"font-size" : "14px"
							}
						})
					);	
					$("timelineInfo").adopt(
						new Element("a", {
							html : "Current state",
							href : "#currentstate",
							styles : {
								cursor: "pointer"
							},							
							events : {
								click : function(){
									drawTICElements(); //return false;
								}
							}
						})
					);
					$("timelineInfo").adopt(new Element("br"));
					$("timelineInfo").adopt(
						new Element("span", {
							html : "Past states (0)"
						})
					);					
				/*************** ROWS MORE THAN 1 data and past tasks **********/		
				} else if (numOfCols > 1) {
					//this was mage a global variable so it could be played as a slideshow
					pastTICStatesIds = [];
					pastTICStatesCurrentIndex = 0;
					pastTICStatesIds.length = 0;
					var pastTICStatesDates = [];
					pastTICStatesDates.length = 0;
					//the first executeStep() was to fill the data, the rest is to fill the past states arrays
					while (statement.executeStep()) { 
						//store past states of the task from the table to a slider
						pastTICStatesIds.push(statement.row.coll_id);
						pastTICStatesDates.push(statement.row.coll_timestamp);								
					}   	
					$("timelineSlideoutInner").empty();
					$("timelineSlideoutInner").adopt(
						new Element ("div#timelineInfo", {
							styles : {
								width : "210px",
								"font-size" : "14px"
							}
						}),					
						new Element ("div#timelineDate", {
							styles : {
								width : "210px",
								height : "92%",
								"font-size" : "12px",
								"margin" : "3px 0px 1px 0px",
								padding : "1px 0px 1px 0px",
								overflow : "auto",
								"border-style" : "solid",
								"border-color" : "#98AFC7",
								"border-width" : "1px 0px 1px 0px"
							}
						})
					);
					$("timelineInfo").adopt(
						new Element("a", {
							html : "Current state",
							href : "#currentstate",
							styles : {
								cursor: "pointer"
							},							
							events : {
								click : function(){
									clearBackgroundTimelineItems();
									pastTICStatesCurrentIndex = 0; //clear the current id of the past states
									drawTICElements(); //return false;
								}
							}
						})
					);					
					$("timelineInfo").adopt(new Element("br"));
					$("timelineInfo").adopt(
						new Element("span#playback", {
							html : "Past states (" + pastTICStatesDates.length + "):",
							styles : {
								"float" : "left"
							}
						})
					);	
					//PLAYBACK BUTTONS	
							//play button				
							$("timelineInfo").adopt(
								new Element("a#playback-play", {
									html : "",
									href : "#statePlay",
									styles : {
										cursor: "pointer",
										"border-color" : "transparent transparent transparent #FFFFFF",
										"border-style" : "solid",
										"border-width" : "8px 0 8px 12px",
										"float" : "left",
										"height" : "0",
										width : "0",
										"margin-left" : "20"
									},							
									events : {
										click : function(){
											stopDrawTICElementsPastStates();
											startDrawTICElementsPastStates(); //return false;
										}
									}
								})
							);		
							//stop button
							$("timelineInfo").adopt(
								new Element("a#playback-stop", {
									html : "",
									href : "#stateStop",
									styles : {
										cursor: "pointer",
										border : "7px solid #FFFFFF",
										"float" : "left",
										height : "0",
										width : "0",
										"margin-left": "10"								
									},							
									events : {
										click : function(){
											stopDrawTICElementsPastStates();
										}
									}
								})
							);				
							//next button	(pause + play)	
							$("timelineInfo").adopt(
								new Element("aplayback-step", {
									html : "",
									href : "#stateNext",
									styles : {
										cursor: "pointer",
										"border-color" : "transparent transparent transparent #FFFFFF",
										"border-style" : "solid",
										"border-width" : "8px 0 8px 12px",
										"float" : "left",
										"height" : "0",
										"width" : "0",
										"margin-left": "10"
									},							
									events : {
										click : function(){
											stopDrawTICElementsPastStates();
											playDrawTICElementsPastStates();
										}
									}
								})
							).adopt(
							    new Element ("span", { //need this part for the second part of the play-pause button
									styles : {
										"border-color" : "transparent #FFFFFF",
										"border-style" : "solid",
										"border-width" : "0 4px 0",
										"float" : "left",
										height : "15px",
										"text-indent" : "-9999px",
										width : "3px"				
									}
								})
							);
					//list of past states
					$('timelineDate').adopt(
						new Element("ul#pastStatesList")
					);
					Array.each(pastTICStatesDates, function(date, index){
						$('pastStatesList').adopt(
							new Element("li#pastState" + index, {
								styles : {
									width : "150",
									"-moz-border-radius" : "3px 3px 3px 3px",
									"border-radius" : "3px 3px 3px 3px"								
								}
							}). adopt(
								new Element ("a",  {
									html : pastTICStatesDates[index],
									href : "#lasttask",
									styles : {
										cursor : "pointer"							
									},							
									events : {
										click : function(){
											pastTICStatesCurrentIndex = index;
											clearBackgroundTimelineItems();
											playDrawTICElementsPastStates();
										}
									}
								})
							)
						);
					});

					// //SLIDER ----- very slow ... it prints out the last TIC so it needs to print TICs two times
					// //set slide to null
					// mySlide = null;
					// //recreate the timelineSlideoutInner div strcture
					// $("timelineSlideoutInner").empty();
					// $("timelineSlideoutInner").adopt(
					// 	new Element ("div#timelineDate"),
					// 	new Element ("div#slideArea").adopt(
					// 		new Element("div#slideKnob")
					// 	)
					// );
					// mySlide = new Slider($('slideArea'), $('slideKnob'), {	
					// 	steps : pastTICStatesIds.length - 1,	
					// 	mode : 'vertical',
					// 	wheel : 'true',
					// 	onChange : function(step){
					// 		$('timelineDate').innerHTML = "<a href=\"#lasttask\" onclick=\"drawTICElements();return false;\">Current state</a><br />" 
					// 									+ "date: " + pastTICStatesDates[step] + "<br/ >id: " 
					// 									+ pastTICStatesIds[step] + "<br />step: " + step;
					// 		drawTICElementsPastStates(pastTICStatesIds[step]);
					// 	}
					// }).set(0);
					//mySlide.detach();									
				}
			}
			statement.finalize();
		}
		//print the task name on the page
		printTaskNameCentre(currentTaskId);
		//print out all the information items
		drawTICElements();
	} else {
		printOut("Not a valid SQL statement: SELECT COUNT(*) AS l FROM tasks_collections WHERE task_id = :tid");
	}		
}

/***************************************************************************
Function saves all information items of the currently selected task (global
variable currentTaskId) to the database
The function is called:
	- doDrop(event): when new items/lements are dragged to the page 
	- addNewNote(): when a new note is put on the page
	- deleteElement(key, name): when an element is deleted from the page
	- window.onunload: when the browser tab or windows closes
	- (function() { databaseSaveTaskCollection(databaseDrawTaskCollection, 
	   currentTaskId) }).periodical(300000): checks for changes every 5 minutes
	- databaseShowTasks(): appand to the task name so it saves the task before task changes
	- drawTICElements(): append to the links of overlapping tasks (the same as above)
****************************************************************************/
function databaseSaveTaskCollection(callback, param) {
	var dataTmp = ""; //this is for the last saved stage of the task/project collection
	//count if the task is empty becuse if it is, the dataTmp can not be compared with data
	var statement = connection.createStatement("SELECT COUNT(*) AS l FROM tasks_collections WHERE task_id = :tid");	
	statement.params.tid = currentTaskId;
	//MOZ_STORAGE_STATEMENT_READY 	1 	The SQL statement is ready to be executed.		
	if (statement.state == 1) {
		statement.executeStep();
		var rows = statement.row.l;
		//finalize the statement as we gather all data
		statement.finalize(); 

		/*CHECK THE OLD STATES*/
		//if there are already some rows related to the task find the last one 
		//to copmpare it to the current
		if (parseInt(rows) > 0){
			var statement = connection.createStatement("SELECT * FROM tasks_collections WHERE task_id = :tid ORDER BY coll_id DESC LIMIT 1");	
			statement.params.tid = currentTaskId;
			//MOZ_STORAGE_STATEMENT_READY 	1 	The SQL statement is ready to be executed.
			if (statement.state == 1) {
				statement.executeStep();	
				var dataTMP = statement.row.coll_items;
				var previousStageId = statement.row.coll_id;
				//finalize the statement as we got the last state of the task from the database
				statement.finalize();
			} else {
				printOut("Not a valid SQL statement: SELECT * FROM tasks_collections WHERE task_id = :tid ORDER BY coll_id DESC LIMIT 1");
			}
		} else {
			//if there are no past states in the database dataTMP is empty
			dataTMP = "{}";
		}

		/*SAVE THE NEW STATE IF IT'S DIFFERENT FROM THE PREVIOUS*/
		//check if the old state is the same as the new one
		if (dataTMP == JSON.encode(data)) {
			//nothing has changed
			callback(param); //rteqrtwertwertwer
		} else {	
			//The STRINGS are NOT the same .. DO some more comparison
			if (compareDataObjectSizeMod(data, JSON.decode(dataTMP)) != false) {
				//if true the objects differ in size and modification time only and we delete the old one
				databaseDeleteTaskStage(previousStageId); 
			}

			//set the time variables
			var currentTime = new Date().format('db');
			var statement = connection.createStatement("INSERT INTO tasks_collections (task_id, coll_timestamp, coll_items) VALUES(:tid, :ts, :items)");
			statement.params.tid = currentTaskId;
			statement.params.ts = currentTime;
			statement.params.items = JSON.encode(data);
			//MOZ_STORAGE_STATEMENT_READY 	1 	The SQL statement is ready to be executed.
			if (statement.state == 1) {
				connection.executeAsync([statement], 1, {
					handleCompletion : function(aReason) {
						// if (aReason != Components.interfaces.mozIStorageStatementCallback.REASON_FINISHED) {  
		  				// 	printOut("Query canceled or aborted!" + aReason);
				  		// } else {
				  		// 	callback(param);
				  		// }   
		  				callback(param);
		  				statement.finalize();   				
		  			},
					handleError : function(aError) {printOut(aError.message);},
					handleResult : function() {}
				});
  			} else {
				printOut("Not a valid SQL statement: INSERT INTO tasks_collections (task_id, coll_timestamp, coll_items) VALUES(:tid, :ts, :items)");
			}
		}

	} else {
		printOut("Not a valid SQL statement: SELECT COUNT(*) AS l FROM tasks_collections WHERE task_id = :tid");
	}	 		
}

/***************************************************************************
Enters a new task to the database from the form and calls a function that 
prints new task list
	- append to the form on the Projects/Tasks panel 
****************************************************************************/
function databaseEnterNewTask() {
	var statement = connection.createStatement("INSERT INTO tasks (task_name) VALUES(:tn)");
	statement.params.tn = $("createName").value;
	//MOZ_STORAGE_STATEMENT_READY 	1 	The SQL statement is ready to be executed.
	if (statement.state == 1) {
		connection.executeAsync([statement], 1, {
			handleCompletion : function(aReason) { 
				if (aReason != Components.interfaces.mozIStorageStatementCallback.REASON_FINISHED) {  
					printOut("Query canceled or aborted!");
				} else {
					printOut("New task \"" + $("createName").value + "\" was successfully created!");
					$('createName').set('value', 'Enter a new project name');
					$('createName').setStyle('color', '#888');
					databaseShowTasks();
				} 
	  			statement.finalize();   				
			},
			handleError : function(aError) {printOut(aError.message);},
			handleResult : function() {
		}
		});		

	} else {
		printOut("Not a valid SQL statement: INSERT INTO tasks (task_name) VALUES(:tn)");
	}
}

/***************************************************************************
Function that finds overlapping tasks for a given URL and returns an array
of coresponding IDs
The function is called:
	- drawTICElements(): checks for every element/item if it is in any other
	  task
	- drawTICElementsPastStates(pastStatesId): the same as above
****************************************************************************/
function databaseOverlapingTasks(informationPath) {
	var tasksIdsArray = [];
	//change \ in windows paths in \\ as this is how  backslashes are stored in db
	informationPath = informationPath.replace( /\\/gi, '\\\\');
    //$("msg").innerHTML += informationPath+"<br />";
	var statement = connection.createStatement("SELECT task_id FROM tasks_collections WHERE coll_items LIKE :pt ");  
	statement.params.pt = "%\"" + informationPath + "\"%"; 
	//statement.params.pt = statement.escapeStringForLIKE("%'" + informationPath + "'%", "'");  
	//MOZ_STORAGE_STATEMENT_READY 	1 	The SQL statement is ready to be executed.
	if (statement.state == 1) { 
		while (statement.executeStep()) { 
			tasksIdsArray.push(statement.row.task_id);	
		}
		statement.finalize();
		return tasksIdsArray.unique();
	} else {
		printOut("Not a valid SQL statement: SELECT * FROM tasks_collections WHERE coll_items LIKE '%:pt%'");
		return false;
	}	
}

/***************************************************************************
Function that handles dropping of information items to the page. When item 
is dropped it hecks the type, adds it to the data variable and saves the new
state to the database.
Dragged types:
* URL
	text/x-moz-url 4: (string) : [http://mootorial.com/wiki/ Strings] - USE THIS
	text/uri-list 4: (string) : [http://mootorial.com/wiki/]
	text/plain 4: (string) : [http://mootorial.com/wiki/]
	text/html 4: (string) : [http://mootorial.com/wiki/]  
* FILE
	application/x-moz-file 1: (object) : [[xpconnect wrapped nsISupports]]
* TEXT - (texmaker, OOo, Word)
	text/html 2: (string) : [Pay particular interest ...]
	text/plain 2: (string) : [Pay particular interest ...] - USE THIS
* EMAIL - Thunderbird
	text/x-moz-url 1: (object) : [null]
* HTML text from WEB (URL)
	text/_moz_htmlcontext 4: (string) : []
	text/_moz_htmlinfo 4: (string) : [0,0]		
	text/html 4: (string) : [The additional methods ...] - USE THIS
	text/plain 4: (string) : [The additional methods ...] 
* Other Types: FOLDER, ... maybe implement NOTE, TALK, TODO
The function is called: 
	- when an item is dropped on the page		
****************************************************************************/
function doDrop(event) { //add new information items to the page and variable data
	//do not propagate default actions when dragging over
	event.stopPropagation();
	event.preventDefault();
	//grab coordinates - if coordinates are on the edge of a screen change them appropriately
	//screenX - coordinates of the computer screen
	//clientX - coordinates of the browser window relative to the top left corner
	//pageX - absolute coordinates of the page including the scrooling
	var tempX = 0;
	if (event.clientX > window.innerWidth - 160) {
	 	tempX = window.innerWidth - 160;
	} else if (event.clientX < 40) {
	 	tempX = 40;
	} else {
		tempX = event.clientX;
	}	
	//$("msg").innerHTML +="-"+event.clientX+"-"+tempX;
	var tempY = 0;
	if (event.clientY > window.innerHeight - 60) {
	 	tempY = window.innerHeight - 37;
	} else if (event.clientY < 50) {
	 	tempY = 50;
	} else {
		tempY = event.clientY;
	}	
	//$("msg").innerHTML +="-"+event.clientY+"-"+tempY;
	//change the coordinates of the new element to the default width 1000px
	//we need this to position the elements right if the window is resized
	//Lower the Y coordinate by 40 so the moving arrows come under the moise pointer	
	var coorX = ((tempX)/(window.innerWidth/1000)).toFixed(parseInt(0)); 
	var coorY = ((tempY-40)/(window.innerHeight/1000)).toFixed(parseInt(0));	


	//count how many items were dragged over to the window
	var count = event.dataTransfer.mozItemCount;
	//for every item find out what is it, append it to data, draw data again and save to DB
	for (var i = 0; i < count; i++) {
		var types = event.dataTransfer.mozTypesAt(i);
		//if file or directory (folder) is dragged over
		if (types[0] == "application/x-moz-file") {	   
			var fileDragged = event.dataTransfer.mozGetDataAt("application/x-moz-file", i);
			if (fileDragged instanceof Components.interfaces.nsIFile){
				var fullPath = fileDragged.path;
				var fileType = fullPath.split(".");
				var extension = fileType.getLast();
				//if (extension.length > 6) {
				if(fileDragged.isDirectory()) { 
					fileType = "FOLDER";
				} else {
					fileType = "FILE";
				}
				//set the global nexKey variable to the next highest index
				var nextKey = findNextKey(data);
				data[nextKey] = {
						type : fileType,
						path : fullPath,
						name : fileDragged.leafName,
						coordinatex : coorX,
						coordinatey : coorY,
						size : fileDragged.fileSize,
						modified : fileDragged.lastModifiedTime,
						timestamp : getTimestamp(),
						vote : "0",
						arrow : "no-no"
				};		
			}
		//if URL is dragged over
		} else if (types[0] == "text/x-moz-url") {
			var urlDragged = event.dataTransfer.mozGetDataAt(types[0], i).trim();
			var url = event.dataTransfer.mozGetDataAt(types[1], i).trim();
			//split data into URL and title
			var title = urlDragged.split("\n");	 
			if (!title[1]) {
				title[1] = url;
			}	
			//set the global nexKey variable to the next highest index
			var nextKey = findNextKey(data);			
			data[nextKey] = {
					type : "URL",
					path : url,
					name : title[1],
					coordinatex : coorX,
					coordinatey : coorY,
					timestamp : getTimestamp(),
					vote : "0",
					arrow : "no-no"
			};		 
		//Text from editors - HTML
		} else if (types[0] == "text/html") {
			var textDragged = event.dataTransfer.mozGetDataAt(types[1], i).trim();	
			//set the global nexKey variable to the next highest index
			var nextKey = findNextKey(data);					 	
			data[nextKey] = {
					type : "TEXT",
					path : "",
					name : textDragged,
					coordinatex : coorX,
					coordinatey : coorY,
					timestamp : getTimestamp(),
					width: "150",
					height: "140",
					vote : "0",
					arrow : "no-no"
			};
		//Text from editors - plain
		} else if (types[0] == "text/plain") {
			var textDragged = event.dataTransfer.getData("text/plain");	
			//set the global nexKey variable to the next highest index
			var nextKey = findNextKey(data);					 	
			data[nextKey] = {
					type : "TEXT",
					path : "",
					name : textDragged,
					coordinatex : coorX,
					coordinatey : coorY,
					timestamp : getTimestamp(),
					width: "150",
					height: "140",					
					vote : "0",
					arrow : "no-no"
			};						 									 	
		//Text from WEB - HTML 
		} else if (types[0] == "text/_moz_htmlcontext") {
			var textDragged = event.dataTransfer.mozGetDataAt(types[2], i);
			textDragged = cleanHtml(textDragged);
			//set the global nexKey variable to the next highest index
			var nextKey = findNextKey(data);		
			data[nextKey] = {
					type : "HTML",
					path : "",
					name : textDragged,
					coordinatex : coorX,
					coordinatey : coorY,
					timestamp : getTimestamp(),
					width: "150",
					height: "140",					
					vote : "0",
					arrow : "no-no"
			};		
		}
	}
	//save to DB and draw the collection
	databaseSaveTaskCollection(databaseDrawTaskCollection, currentTaskId);	
} 

/***************************************************************************
Function that finds next key which is one more than the last inserted.
The function is called:
	-drawGeneralIcons(): append to the note icon s when it's clicked it calls this finction 
****************************************************************************/
function addNewNote() {
	var nextKey = findNextKey(data);			
	data[nextKey] = {
			type : "NOTE",
			name : "Double click on the text to edit note.\nClick elsewhere to save.\n\nPossible to use HTML tags",
			coordinatex : "75",
			coordinatey : "60",
			timestamp : getTimestamp(),
			width: "150",
			height: "140",			
			vote : "0",
			arrow : "no-no",
			extension : "icons_content/TEXT.png"
	};
	databaseSaveTaskCollection(databaseDrawTaskCollection, currentTaskId);		
}

/***************************************************************************
Function that returns next key from an object which is one more than the last 
inserted. The function is called:
	- doDrop(event): when new items are dropped on the page it gets the id for it
	- addNewNote(): when a nw note is added .. the same as above
****************************************************************************/
function findNextKey(datatmp) {
	var tmplenght = Object.getLength(datatmp);
	if (tmplenght == 0) {
		nextKey = 0;
	} else {
		var keys = Object.keys(datatmp);		
		nextKey = keys.max() + 1;
	}
	return nextKey;
}

/***************************************************************************
Function that iterates through a given object and deletes all content in it
The function is called:
	- databaseDrawTaskCollection(taskid): empties the data object so it can 
	  get the new task stage in
****************************************************************************/
function emptyObject(datatmp) {
	Object.each (datatmp, function(value, key){
		delete data[key];
	});
}

/***************************************************************************
Prints messages on the screen
The functions are called: 
printOut(message) 
	- whenever there's a message to print out
printOutHide()
	- databaseConnect(): it hides the printOut message so the About box
	  can be shown when the TIc is run for the firts time
printAboutShow()
    - databaseConnect(): prints out the About box when the TIC is run for the first time
printAboutHide()
	- append to the button in the About box     
****************************************************************************/
function printOut(message){	
	$("printText").removeClass("hidden");
	(function() {$("printText").addClass("hidden")}).delay(4000);
	$("printText").set('html', message);
}

function printOutHide(){	
	$("printText").addClass("hidden");
}

function printAboutShow(){	
	$("aboutI").removeClass("hidden");
}

function printAboutHide(){	
	$("aboutI").addClass("hidden");
	//print out the message to drag some data over
	printOut("Drag files, folders, web pages or pieces of text over to this page.");	
}

/***************************************************************************
Converts bytes to human readable format
The function is called:
	- drawTICElements(): converts size in the more information box of every 
	  item that has this value
	- drawTICElementsPastStates(pastStatesId): the same as above
****************************************************************************/
function bytesToSize(bytes) {  
	//thx http://bateru.com/news/2011/08/code-of-the-day-javascript-convert-bytes-to-kb-mb-gb-etc/
	var units = [ ' bytes', ' KB', ' MB', ' GB', ' TB', ' PB', ' EB', ' ZB', ' YB' ];
	var amountOf2s = Math.floor( Math.log( +bytes )/Math.log(2) );
	if( amountOf2s < 1 ){
		amountOf2s = 0;
	}
	var i = Math.floor( amountOf2s / 10 );
	bytes = +bytes / Math.pow( 2, 10*i );
 
	//Cuts to 3 decimals places.
	if( bytes.toString().length > bytes.toFixed(3).toString().length ){
		bytes = bytes.toFixed(3);
	}
	return bytes + units[i];
}

/***************************************************************************
Function that open applications or file manager
The functions are called:
fileOpen(filetmp) Open files with local applications
	- drawTICElements(): when clicked on an element/item name (files)
	- drawTICElementsPastStates(pastStatesId): the same as above
folderOpen(filetmp) and folderOpenLinux(filetmp) Open folder of a selected 
	file or folder
	- drawTICElements(): when clicked on a path of an element/item in the 
	  more information box for files and folders
	- drawTICElementsPastStates(pastStatesId): the same as above
	- drawGeneralIcons(): opening a home folder or desktop
****************************************************************************/
function fileOpen(filetmp){
	var file = Components.classes["@mozilla.org/file/local;1"].createInstance(Components.interfaces.nsILocalFile);  
	file.initWithPath(filetmp); 
	if ( file.exists() ) { 
		file.launch();  
	} else {
		printOut("The file or the folder you selected does not exists on your local hard drive!");
	}
}

function folderOpen(filetmp){
	var file = Components.classes["@mozilla.org/file/local;1"].createInstance(Components.interfaces.nsILocalFile);  
	file.initWithPath(filetmp); 
	if ( file.exists() ) { 
		file.reveal();  
		//could also use this to get the parent folder of a file
		// folder = file.parent;		
	} else {
		printOut("The folder you selected does not exists on your local hard drive!");
	}
}

/***************************************************************************
Get a file size from the given file
The function is called:
	- drawTICElements(): checkes for the new size 
	  in the more information box of every item that has this value
****************************************************************************/
function fileSizes(filetmp){
	var file = Components.classes["@mozilla.org/file/local;1"].createInstance(Components.interfaces.nsILocalFile);  
	if (file.initWithPath(filetmp)) { 
		if ( file.exists() ) { 
			return file.fileSize;  
		} else {
			return "not available";
		}
	}
}

/***************************************************************************
Get a modification time from the given file
The function is called:
	- drawTICElements(): checkes for the new modification time
	  in the more information box of every item that has this value
	- drawTICElementsPastStates(pastStatesId): the same as above
****************************************************************************/
function fileModified(filetmp){
	var file = Components.classes["@mozilla.org/file/local;1"].createInstance(Components.interfaces.nsILocalFile);  
	if (file.initWithPath(filetmp)) {  
		if ( file.exists() ) { 
			return file.lastModifiedTime;  
		} else {
			return "not available";
		}
	}
}

/***************************************************************************
Convert unix time to yyyy-mm-dd hh:mm
The function is called:
	- drawTICElements(): converts the modification time
	  in the more information box of every item that has this value
	- drawTICElementsPastStates(pastStatesId): the same as above
****************************************************************************/
function unixToTime(unixTime){
	// var a = new Date(unixTime); //*1000);  
	// var year = a.getFullYear();
	// var month = a.getMonth();
	// month = String(month + 1);
	// if (month.length == 1) {
	// 	month = "0" + month;
	// }
	// var day = a.getDate();
	// day = String(day);
	// if (day.length == 1) {
	// 	day = "0" + day;
	// }
	// var hour = a.getUTCHours();
	// hour = String(hour);
	// if (hour.length == 1) {
	// 	hour = "0" + hour;
	// }	
	// var min = a.getUTCMinutes();
	// min = String(min);
	// if (min.length == 1) {
	// 	min = "0" + min;
	// }	  
	// var sec = a.getUTCSeconds();
	// var time = year + "-" + month + "-" + day + " " + hour + ':' + min;
	// return time;

	var time = new Date(unixTime).format('db');
	return time; 
}

/***************************************************************************
The function gets the current date and time in YYYY-MM-DD HH:MM:SS format
The function is called:
	- doDrop(event): puts a time stamp to the newly dropped item on a page
 	- addNewNote(): the same as above 
****************************************************************************/
function getTimestamp(){
	var time = new Date().format('db');
	return time;
}

/***************************************************************************
The function clears the background of all the past states in the timeline tab
The function is called:
	- databaseDrawTaskCollection(taskid): clears the bg of possible highlighted
	  items in a timeline on the side panel
****************************************************************************/
function clearBackgroundTimelineItems(){
	Array.each(pastTICStatesIds, function (data, index){
		$("pastState" + index).setStyle('background-color', null);
	});
}

/***************************************************************************
Tips with mouseover NOT IMPLEMENTED
****************************************************************************/
function tipShow(el) {
	var tipText = $(el).getProperty('title');
	$(el).erase('title');
	$(el).adopt(
		new Element("span#tip",{
			class : "tipHidden",
			text : tipText
		})
	);
	$('tip').set('class', 'tipVisible');
}

function tipHide(el) {
}

/***************************************************************************
Calculate the angle from a point on a page to the centre.
Return array angle & quadrant
The function is called:
	- drawTICElements(): gets the angle of arrows for every item/element on 
	  the page and when the items are moved it changes it
	- drawTICElementsPastStates(pastStatesId): the same as above except moving
****************************************************************************/
function getAngle(coorX,coorY) {
	//transform the coordinates so the centre of a page is (0,0)
	//(0,0) is originaly in the top left corner 
	var newX = coorX - (window.innerWidth/2) + 5.5;
	var newY = -coorY + (window.innerHeight/2) - 39;	

	var quadrant;
	//var tangentA = Math.abs(newY)/Math.abs(newX); //deltaY/deltaX;
	//var radians1 = Math.atan(tangentA); // inverse tangent tan^(-1)
	//var angle1 = radians1*(180/Math.PI);
	var radians2 = Math.atan2(newY,newX);
	var angle2 = radians2*(180/Math.PI);;
	//check in which quadrant the point x,y is 
	if ((newX >= 0) && (newY >= 0)) {
		quadrant = 1;
	} else if ((newX < 0)&& (newY >= 0)) {
		quadrant = 2;
	} else if ((newX < 0) && (newY < 0)) {
		quadrant = 3;
	} else if ((newX >= 0) && (newY < 0)) {
		quadrant = 4;
	}
	//$("msg").innerHTML += Math.round(angle1*100)/100 + ":" + Math.round(angle2*100)/100 + "-";
	angle2 = -angle2;
	var array = [angle2, quadrant];
 	return array;
}

/***************************************************************************
Clean html of all formating and empty tags
The function is called:
	- drawTICElements(): before showing notes
	- drawTICElementsPastStates(pastStatesId): the same as above 
	- doDrop(event): when text is dragged over it cleans it before saving
****************************************************************************/
function cleanHtml(str) {
	str = str.replace( /<\s*p[^>]+>/gi, "<p>");
	str = str.replace( /<\s*h[1-6][^>]*>/gi, "<strong>") ;
	str = str.replace( /<\/h[1-6][^>]*>/gi, "</strong>") ;
	str = str.replace( /<\s*font[^>]*>/gi, "<font>") ;
	str = str.replace( /<\s*span[^>]*>/gi, "<span>") ;
	str = str.replace( /<\s*div[^>]*>/gi, "<div>") ;
	str = str.replace( /<[^>]>(&nbsp;|\s|\t)*<\/[^>]+>/gm, '' ) ; //empty tags
	str = str.replace( /<\s*table[^>]*>/gi, "<table>") ;
	str = str.replace( /<\s*th[^>]*>/gi, "<th>") ;
	str = str.replace( /<\s*tr[^>]*>/gi, "<tr>") ;
	str = str.replace( /<\s*td[^>]*>/gi, "<td>") ;
	str = str.replace( /<\s*ul[^>]*>/gi, "<ul>") ;		
	str = str.replace( /<\s*li[^>]*>/gi, "<li>") ;
	str = str.replace( /<\s*ol[^>]*>/gi, "<ol>") ;
 	return str.trim();
}

/***************************************************************************
Returns a random date between two other dates
var randomDateTmp = randomDate('1999-06-08 16:34:52', new Date()); 
The function is called:
	- not called .. used for testing purposes
****************************************************************************/
function randomDate(date1, date2) {
   var minD = new Date().parse(date1).format('%s');
   var maxD = new Date().parse(date2).format('%s');
   var random = Number.random(parseInt(minD), parseInt(maxD));
   var randomDate = new Date().parse(random + "000").format('db');
   return randomDate;
}

/***************************************************************************
Compares specific two data objects and finds the differences between them.
Never checking: extension, type, path, timestamp
compareDataObjectSizeMod(data1, data2): 
	returns TRUE: if changed size, modified
	   event: The last stored state in DB will be deleted after the new one is saved.
	returns FALSE: if changed coordinates, name, vote, email, person, arrow, url, note, date, vote
	returns FALSE: objects are not of the same length 
	   event: New stage will be saved and no previous deleted
The function is called:
	- compareAndCleanStages(): deleted stages without significant changes
	- databaseSaveTaskCollection (callback, param): checked if the new state differs in 
	  size and modofication only 
compareDataObjectCoordinates(data1, data2): 
	returns TRUE: if changed coordinates
	returns FALSE: if changed size, modified, name, vote, email, person, arrow, url, note, date, vote
	returns FALSE: objects are not of the same length 
The function is called:	   
	- compareAndCleanStages(): deleted stages without significant changes
****************************************************************************/
function compareDataObjectSizeMod(data1, data2) {
	//check if the objects are of the same length 
	//if they are not return false and the new task will be saved.
	if (Object.getLength(data1) != Object.getLength(data2)) {
		return false;
		//this means an item has been added or deleted to the new stage
		//this can happen because a new state is also saved when items are
		//added doDrop(event) or deleted deleteElement(key, name)
	} else { 
		//if they are of the same length compare values
		var countChangesT = 0; //returning true if not null
		var countChangesF = 0; //returning false if not null
		Object.each (data2, function(value, key){
 
			//CHECK if the arrays are the same length ...
			//find out which array is longer so we'll start traversing that one ...
			if (Object.getLength(value) <= Object.getLength(data1[key])) {
				var dataOuter = data1[key];
				var dataInner = value;
			} else {
				var dataOuter = value;
				var dataInner = data1[key];					
			}

			//traverse the item' s tags of the longer array 
			//and check which one does not exist in the shorter one and which one changed				
			Object.each(dataOuter, function(item, index){
				if (dataInner[index] != null) { //check if index exists in the other array
					//$("msg").innerHTML += "-y-";		
					if (dataInner[index] != item) { //check if he value has changed
		    			if (index == "modified" || index == "size") {
		    				countChangesT = countChangesT + 1;
		    				//$("msg").innerHTML += "1-i:" + index + "-item:" + item;
	    				} 
	    				if (index == "coordinatex" || index == "coordinatey" || index == "name" || index == "vote"
	    					 || index == "email" || index == "person" || index == "arrow" || index == "url"
	    					 || index == "note" || index == "date" || index == "vote") {
	    					countChangesF = countChangesF + 1;
	  						//$("msg").innerHTML += "2-i:" + index + "-item:" + item;
	    				}
    				}
				} else { //find out which index (tag of an element) exist in th longer array and not in shorter
		    			if (index == "modified" || index == "size") {
		    				countChangesT = countChangesT + 1;
		    				//$("msg").innerHTML += "3-i:" + index + "-item:" + item;
	    				} 
	    				if (index == "coordinatex" || index == "coordinatey" || index == "name" || index == "vote"
	    					 || index == "email" || index == "person" || index == "arrow" || index == "url"
	    					 || index == "note" || index == "date" || index == "vote") {
	    					countChangesF = countChangesF + 1;
							//$("msg").innerHTML += "4-i:" + index + "-item:" + item;
	    				}
				}
			});

		});

		if (countChangesF > 0){
			return false;
		} else {
			return true;
		}
	}
}

function compareDataObjectCoordinates(data1, data2) {
	//check if the objects are of the same length 
	//if they are not return false and the new task will be saved.
	if (Object.getLength(data1) != Object.getLength(data2)) {
		return false;
		//this means an item has been added or deleted to the new stage
		//this can happen because a new state is also saved when items are
		//added doDrop(event) or deleted deleteElement(key, name)
	} else { 
		//if they are of the same length compare values
		var countChangesT = 0; //returning true if not null
		var countChangesF = 0; //returning false if not null
		Object.each (data2, function(value, key){
 
			//CHECK if the arrays are the same length ...
			//find out which array is longer so we'll start traversing that one ...
			if (Object.getLength(value) <= Object.getLength(data1[key])) {
				var dataOuter = data1[key];
				var dataInner = value;
			} else {
				var dataOuter = value;
				var dataInner = data1[key];					
			}

			//traverse the item' s tags of the longer array (if deleting tags will ever be implemented)
			//and check which one does not exist in the shorter one and which one changed				
			Object.each(dataOuter, function(item, index){
				if (dataInner[index] != null) { //check if index exists in the other array
					//$("msg").innerHTML += "-y-";		
					if (dataInner[index] != item) { //check if he value has changed
		    			if (index == "coordinatex" || index == "coordinatey") {
		    				countChangesT = countChangesT + 1;
		    				//$("msg").innerHTML += "1-i:" + index + "-item:" + item;
	    				} 
	    				if (index == "modified" || index == "size" || index == "name" || index == "vote"
	    					 || index == "email" || index == "person" || index == "arrow" || index == "url"
	    					 || index == "note" || index == "date" || index == "vote") {
	    					countChangesF = countChangesF + 1;
	  						//$("msg").innerHTML += "2-i:" + index + "-item:" + item;
	    				}
    				}
				} else { //find out which index (tag of an element) exist in th longer array and not in shorter
		    			if (index == "coordinatex" || index == "coordinatey") {
		    				countChangesT = countChangesT + 1;
		    				//$("msg").innerHTML += "3-i:" + index + "-item:" + item;
	    				} 
	    				if (index == "modified" || index == "size" || index == "name" || index == "vote"
	    					 || index == "email" || index == "person" || index == "arrow" || index == "url"
	    					 || index == "note" || index == "date" || index == "vote") {
	    					countChangesF = countChangesF + 1;
							//$("msg").innerHTML += "4-i:" + index + "-item:" + item;
	    				}
				}
			});

		});

		if (countChangesF > 0){
			return false;
		} else {
			return true;
		}
	}
}

/***************************************************************************
Print out preferences. 
The function is called:
	- for testing purposes only 
****************************************************************************/
function getPreferences(){
	var prefs = Components.classes["@mozilla.org/preferences-service;1"]
	                      .getService(Components.interfaces.nsIPrefService);
	var branch = prefs.getBranch("extensions.tic.");
	var children = branch.getChildList("", {});
	//$("msg").innerHTML = children;	
	var share4research2 = branch.getIntPref("share4research2");
	//$("msg").innerHTML += "-"+share4research2;
	var fileManager = branch.getCharPref("fileManager");
	//$("msg").innerHTML += "-"+fileManager;	
}


