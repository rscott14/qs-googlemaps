//Created by Ron Scott Test
define([
	"jquery"
	], 
function($) {'use strict';
	// $("<style>").html(cssContent).appendTo("head");
	return {
		initialProperties : {
			qHyperCubeDef : {
				qDimensions : [],
				qMeasures : [],
				qInitialDataFetch : [{
					qWidth : 10,
					qHeight : 1000
				}]
			},
		},
		definition : {
			type : "items",
			component : "accordion",
			items : {
				dimensions : {
					uses : "dimensions",
					min : 1,
					max : 10
				},
				measures : {
					uses : "measures",
					min : 0,
					max : 1
				},
				sorting : {
					uses : "sorting"
				},
				settings : {
					uses : "settings",
					items : {
						initFetchRows : {
							ref : "qHyperCubeDef.qInitialDataFetch.0.qHeight",
							label : "Initial fetch rows",
							type : "number",
							defaultValue : 1000
						},
						googleAPIKey : {
							ref: "properties.apikey",
							label: "Google API Key",
							type: "string"
						},
						dissipationFlag: {
							type: "boolean",
							component: "switch",
							label: "Heatmap Dissipation",
							ref: "properties.heatmapDissipation",
							options: [{
								value: true,
								label: "On"
							}, {
								value: false,
								label: "Off"
							}],
							defaultValue: true
						},
						mapTypeFlag: {
							type: "string",
							component: "dropdown",
							label: "Map Type",
							ref: "properties.mapType",
							options: [{
								value: "marker",
								label: "Markers"
							}, {
								value: "heatmap",
								label: "Heatmap"
							}],
							defaultValue: "marker"
						},
						mapSettings: {
							type: "items",
							label: "Map Settings",
							items: {
								zoom: {
									ref: "properties.zoom",
									label: "Zoom Level (Default: 4)",
									type: "integer",
									expression: "optional",
									defaultValue: 4
								},
								centerPoint: {
									ref: "properties.centerPoint",
									label: "Center GeoPoint",
									type: "string",
									expression: "optional",
									defaultValue: "{lat:41.85, lng: -87.64999999999998}"
								}
							}
						}
					}
				}
			}
		},
		snapshot : {
			canTakeSnapshot : true
		},
		paint : function($element, layout) {

			var self = this;

//			console.log('HyperCube: ' + layout.qHyperCube);
			var b2iConfig = {
				"hCube" : layout.qHyperCube,
				"mapID" : layout.qInfo.qId,
				"disFlag" : layout.properties.heatmapDissipation,
				"mapType" : layout.properties.mapType,
				"centerPoint" : layout.properties.centerPoint,
				"zoom" : layout.properties.zoom
			};


			
			console.log("MapType?:" + b2iConfig.mapType);
			console.log('Dissipation?:' + b2iConfig.disFlag);
			console.log('Google Object = ' + typeof window.google);
			// Clear out the element for refresh.
			console.log('paint: map_' + b2iConfig.mapID);

			//Clear the map and redraw
			$element.empty();
			
			//Check for API Key existence
			if (typeof layout.properties.apikey === 'undefined' || layout.properties.apikey === ''){
				var html = '<div style="height:100%" id="map_' + b2iConfig.mapID + '"><br><b>Please Enter your Google Maps API Key in the Settings Panel</b><br></div>';
				$element.html(html);
				return; // Do not continue with map making.
			} else {
				var html = '<div style="height:100%" id="map_' + b2iConfig.mapID + '"></div>';
				$element.html(html);
			}
					

			if(typeof google === 'undefined'){
				console.log("Loading Google API");
				$.getScript("https://maps.googleapis.com/maps/api/js?libraries=visualization&key=" + layout.properties.apikey)
					.done(function (script, textStatus) {
						console.log(textStatus);
						initMap(b2iConfig);
					})
					.fail(function (jqxhr, settings, exception) {
						$("#map_" + b2iConfig.mapID).text("Error Loading Google");
					});
			} else {
				console.log("Skipping Google API load (already loaded)...");
				initMap(b2iConfig);
			}
		}
	};
});

function getUniqueText(data, index){
	var uniqueNames = [];
	for(i = 0; i< data.length; i++){    
		if(uniqueNames.indexOf(data[i][index].qText) === -1){
			uniqueNames.push(data[i][index].qText);        
		}        
	}
	return uniqueNames;
}


function initMap(b2iConfig) {

	var mapID = b2iConfig.mapID;
	var hCube = b2iConfig.hCube;

	debugger;
	var uluru = {lat: -25.363, lng: 131.044};
	var chicago = {lat:41.85, lng: -87.64999999999998};
	var us = {lat:37.09024, lng:-95.712891}; //?
	var kansas = {lat:39, lng:-98};

	var mCenter = ((b2iConfig.centerPoint !== "")? JSON.parse(b2iConfig.centerPoint) : chicago);
	var zoom = ((b2iConfig.zoom !== "")? b2iConfig.zoom : 4);;

	//Build the Map ** Opportunity to cut down on GMap costs by only creating new map when dimensions of window change.
	console.log('initMap: map_' + mapID );
	console.log('element:' + document.getElementById('map_' + mapID));
	var map = new google.maps.Map(document.getElementById('map_' + mapID), {
		// var map = new google.maps.Map(document.getElementById('map'), {
		"zoom": zoom, //4
		"center": mCenter
	});

	// //render titles
	console.log('Dimensions & Measures:');
	$.each(hCube.qDimensionInfo, function (key, value) {
		console.log("Dimensions: " + value.qFallbackTitle);
	});
	$.each(hCube.qMeasureInfo, function (key, value) {
		console.log("Measures: " + value.qFallbackTitle);
	});

	var measureLength = hCube.qMeasureInfo.length;
	var dimLength = hCube.qDimensionInfo.length;

	var mapData = [];
	var lastrow = 0;

	//Geopoint Regular Expression match Format: [-#.#,-#.#]
	var re = /\[[-+]?([1-8]?\d(\.\d+)?|90(\.0+)?),\s*[-+]?(180(\.0+)?|((1[0-7]\d)|([1-9]?\d))(\.\d+)?)\]/g;

	//Loop through the dimensions and create markers
	for (let i = 0; i < dimLength; i++) {

		//Only create a single unique marker
		var uniques = getUniqueText(hCube.qDataPages[0].qMatrix,i);
		uniques.forEach(function (marker,index){
			try {

				var markerObj = {};
				if(marker.match(re)){
					var array = JSON.parse(marker);
					markerObj.lat = Number(array[0]);
					markerObj.lng = Number(array[1]);
				} else {
					markerObj = JSON.parse(marker);
				}

				//Do I need to validate formating?
				markerObj.config = b2iConfig;
				markerObj.map = map;

				switch (b2iConfig.mapType) {
					case "marker":
						createMarker(markerObj);
						break;
				
					case "heatmap":
						//Needs rework - will not work.
						// mapData.push({location:new google.maps.LatLng(coords[0], coords[1])});
						// mapData[mapData.length-1].weight = cell.qNum
						break;
					default:
						break;
				}
				
			} catch (error) {
				console.log("Dimension is not a Google Marker object or GeoPoint");
			}
		});
	}
	
// 	var markerCluster = new MarkerClusterer(map, markers,
// 		{imagePath: 'https://developers.google.com/maps/documentation/javascript/examples/markerclusterer/m'});
//   }

	//Cycle through hypercube rows.
	// $.each(hCube.qDataPages[0].qMatrix, function(rownum, row) {
	// 	lastrow = rownum;

	// 	$.each(row, function (key, cell) {
	// 		// console.log("Key: " + key);
	// 		// console.log("Cell: " + JSON.stringify(cell));
	// 	});
	// });


	
}

function createMarker(markerObj){

	//Need to add logic to parse the markerObj
	debugger;
	var gMarker = {};
	gMarker.map = markerObj.map;

	//If geoPoint Exists parse it into lat an long.
	if(markerObj.geoPoint) {
		gMarker.position = JSON.parse(markerObj.geoPoint);
	} else {
		gMarker.position = { lat: Number(markerObj.lat), lng: Number(markerObj.lng)};
	}

	//If title exists populate the title
	if(markerObj.title){
		gMarker.title = markerObj.title;
	}

	if(markerObj.icon){
		gMarker.icon = markerObj.icon;
	}

	//Create Google Marker
	var marker = new google.maps.Marker(gMarker);

	if (markerObj.circleRadius){
		var markerCircle = new google.maps.Circle({
			center: gMarker.position,
			strokeColor: '#FF0000',
			strokeOpacity: 0.8,
			strokeWeight: 2,
			fillColor: '#FF0000',
			fillOpacity: 0.35,
			map: gMarker.map,
			radius: markerObj.circleRadius
		});
	}

	var contentString = '<div id="content">'+
	'<div id="siteNotice">'+
	'</div>'+
	'<h1 id="firstHeading" class="firstHeading">Uluru</h1>'+
	'<div id="bodyContent">'+
	'<p><b>Uluru</b>, also referred to as <b>Ayers Rock</b>, is a large ' +
	'sandstone rock formation in the southern part of the '+
	'Northern Territory, central Australia. It lies 335&#160;km (208&#160;mi) '+
	'south west of the nearest large town, Alice Springs; 450&#160;km '+
	'(280&#160;mi) by road. Kata Tjuta and Uluru are the two major '+
	'features of the Uluru - Kata Tjuta National Park. Uluru is '+
	'sacred to the Pitjantjatjara and Yankunytjatjara, the '+
	'Aboriginal people of the area. It has many springs, waterholes, '+
	'rock caves and ancient paintings. Uluru is listed as a World '+
	'Heritage Site.</p>'+
	'<p>Attribution: Uluru, <a href="https://en.wikipedia.org/w/index.php?title=Uluru&oldid=297882194">'+
	'https://en.wikipedia.org/w/index.php?title=Uluru</a> '+
	'(last visited June 22, 2009).</p>'+
	'</div>'+
	'</div>';

	var infowindow = new google.maps.InfoWindow({
		content:contentString
	});

	marker.addListener('click',function(){
		infowindow.open(gMarker.map, marker);
	})

}

function createHeatmap(heatmapData, map){
	// console.log(heatmapData);

	var heatmap = new google.maps.visualization.HeatmapLayer({
		data: heatmapData,
		dissipating: true,
		// radius:100,
		map: map
	});

}
// Data Notes:
// layout.qHyperCube.qDimensionInfo: dimensions used
// layout.qHyperCube.qMeasureInfo: measures used
// layout.qHyperCube.qDataPages: the result


//Finding Numberic Data elements and making them selectable.
// if(cell.qIsOtherCell) {
// 	cell.qText = self.backendApi.getDimensionInfos()[key].othersLabel;
// }
// html += "<td class='";
// if(!isNaN(cell.qNum)) {
// 	html += "numeric ";
// }
// //total (-1)  is not selectable
// if(key < dimcount && cell.qElemNumber !== -1) {
// 	html += "selectable' data-value='" + cell.qElemNumber + "' data-dimension='" + key + "'";
// } else {
// 	html += "'";
// }
// html += '>' + cell.qText + '</td>';


// Heatmap gradient of blue and "red"
// function changeGradient() {
// 	var gradient = [
// 		'rgba(0, 255, 255, 0)',
// 		'rgba(0, 255, 255, 1)',
// 		'rgba(0, 191, 255, 1)',
// 		'rgba(0, 127, 255, 1)',
// 		'rgba(0, 63, 255, 1)',
// 		'rgba(0, 0, 255, 1)',
// 		'rgba(0, 0, 223, 1)',
// 		'rgba(0, 0, 191, 1)',
// 		'rgba(0, 0, 159, 1)',
// 		'rgba(0, 0, 127, 1)',
// 		'rgba(63, 0, 91, 1)',
// 		'rgba(127, 0, 63, 1)',
// 		'rgba(191, 0, 31, 1)',
// 		'rgba(255, 0, 0, 1)'
// 	]
//// toggles gradient
// 	heatmap.set('gradient', heatmap.get('gradient') ? null : gradient);
// }


