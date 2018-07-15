//Created by Ron Scott Test

// Todo: 
// Clusters
// Heatmap weight based on measures
// 

//Global map variable (facilitates syncronized zoom on maps)
var b2iMaps = {};


define([
	"jquery","qlik"
	], 
function($,qlik) {'use strict';
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
						initFetchWidth : {
							ref : "qHyperCubeDef.qInitialDataFetch.0.qWidth",
							label : "Initial fetch width",
							type : "number",
							defaultValue : 10
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
							defaultValue: false
						},
						heatRadius: {
							type: "number",
							label: "Heatmap Radius",
							ref: "properties.heatmapRadius",
							defaultValue: 1
						},
						heatGradient: {
							type: "string",
							label: "Heatmap Gradient",
							ref: "properties.heatmapGradient",
							defaultValue: "default"
						},
						heatIntensity: {
							type: "number",
							label: "Heatmap Intensity",
							ref: "properties.heatmapIntensity",
							defaultValue: 0
						},
						heatOpacity: {
							type: "number",
							label: "Heatmap Opacity (0->1)",
							ref: "properties.heatmapOpacity",
							defaultValue: 0.4
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
									defaultValue: '{\"lat\":41.85, \"lng\": -87.64999999999998}'
								},
								mapSync: {
									ref: "properties.mapsync",
									label: "Syncronize with me: Map ID",
									type: "string",
									expression: "optional"
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

			var multiextension = false;
			if ($('div[id^="map_"]').length > 0){
				multiextension = true;
			}

//			console.log('HyperCube: ' + layout.qHyperCube);
			var b2iConfig = {
				"hCube" : layout.qHyperCube,
				"mapID" : layout.qInfo.qId,
				"disFlag" : layout.properties.heatmapDissipation,
				"radius" : layout.properties.heatmapRadius,
				"intensity" : layout.properties.heatmapIntensity,
				"gradient" : layout.properties.heatmapGradient,
				"opacity" : layout.properties.heatmapOpacity,
				"mapType" : layout.properties.mapType,
				"centerPoint" : layout.properties.centerPoint,
				"mapsync": layout.properties.mapsync,
				"zoom" : layout.properties.zoom,
				"qlik" : qlik
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
					
			if(typeof google === 'undefined' && !multiextension){
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
				//Wait for google to load
				function googleCheck() {
					if(typeof google === 'undefined'){
						setTimeout(googleCheck(),1000);
					} else
					{
						initMap(b2iConfig);
					}
				}							
				setTimeout(googleCheck,1000)
			}
		}
	};
});

function getUniqueText(hCube, index){
	var uniqueNames = [];

	var data = hCube.qDataPages[0].qMatrix;

	var dimLength = hCube.qDimensionInfo.length;
	//If measure exists then use as weight
	var hasWeight = (hCube.qMeasureInfo.length > 0)?true:false;

	for(i = 0; i< data.length; i++){    
		//if(uniqueNames.indexOf(data[i][index].qText) === -1){
		//If the current row doesn't already exist in the return set then add it.
		if(!uniqueNames.find(o => o.row === data[i][index].qText)){

			uniqueNames.push({
				"row":data[i][index].qText,
				"weight":(hasWeight)?data[i][dimLength].qNum:1
			});
		}        
	}
	return uniqueNames;
}


function initMap(b2iConfig) {

	var mapID = b2iConfig.mapID;
	var hCube = b2iConfig.hCube;

	//debugger;
	var uluru = {lat: -25.363, lng: 131.044};
	var chicago = {lat:41.85, lng: -87.64999999999998};
	var us = {lat:37.09024, lng:-95.712891}; //?
	var kansas = {lat:39, lng:-98};

	//fix centerpoint formating for JSON parse
	b2iConfig.centerPoint = b2iConfig.centerPoint.replace(/lng/g,'"lng"');
	b2iConfig.centerPoint = b2iConfig.centerPoint.replace(/lat/g, '"lat"');
	b2iConfig.centerPoint = b2iConfig.centerPoint.replace(/""/g, '"');

	var mCenter = ((b2iConfig.centerPoint !== "")? JSON.parse(b2iConfig.centerPoint) : chicago);
	var zoom = ((b2iConfig.zoom !== "")? b2iConfig.zoom : 4);

	//Check for existing map/values
	if(b2iMaps.hasOwnProperty(mapID)){
		if(b2iConfig.mapsync && b2iMaps[b2iConfig.mapsync]){
			zoom = b2iMaps[b2iConfig.mapsync].map.zoom;
			mCenter = b2iMaps[b2iConfig.mapsync].map.center.toJSON();
		} else {
			zoom = b2iMaps[mapID].map.zoom;
			mCenter = b2iMaps[mapID].map.center.toJSON();
		}
	} else
	{
		b2iMaps[mapID] = {};
	}

	//Build the Map ** Opportunity to cut down on GMap costs by only creating new map when dimensions of window change.
	console.log('initMap: map_' + mapID );
	console.log('element:' + document.getElementById('map_' + mapID));
	var map = new google.maps.Map(document.getElementById('map_' + mapID), {
		// var map = new google.maps.Map(document.getElementById('map'), {
		"zoom": zoom, //4
		"center": mCenter
	});
	
	//Global Map Object
	b2iMaps[mapID].map = map;

	//Implement map sync events
	if (b2iConfig.mapsync && b2iMaps[b2iConfig.mapsync]){
		console.log("Setting up Sync listeners");

		map.addListener('center_changed', function (){
			console.log("SyncCenter Fired.");
			var mirrorMap = b2iMaps[b2iConfig.mapsync].map;
			mirrorMap.setCenter(map.center.toJSON());
			mirrorMap.setZoom(map.zoom);
		});

		map.addListener('zoom_changed', function () {
			console.log("SyncZoomed Fired.");
			var mirrorMap = b2iMaps[b2iConfig.mapsync].map;
			mirrorMap.setCenter(map.center.toJSON());
			mirrorMap.setZoom(map.zoom);
		});
	}

	//If in Qlik Edit mode add an overlay with the ID
	if (b2iConfig.qlik.navigation.getMode() === 'edit') {
		var contentString = '<div id="m_id" class="firstHeading">' + mapID + '</div>';
		var infoWindow = new google.maps.InfoWindow({
			content: contentString,
			position: b2iMaps[mapID].map.center.toJSON()
		});

		infoWindow.open(map);
		b2iMaps[mapID].infoWindow = infoWindow;

		map.addListener('center_changed', function () {
			var infoWindow = b2iMaps[mapID].infoWindow;
			infoWindow.setPosition(b2iMaps[mapID].map.center.toJSON());
		});
	};

	//Can use map.panTo(position); to set the center of the map. or use map.setCenter(position)
	//var bounds = {north:xx.xxxx,south:xx.xxx,east:xx.xxx,west:xx.xxx};
	//Can also use map.fitBounds(bounds) to set a specific area
	//Possibility to allways have zoom start at "world" view aka zoom: 3
	//Center Point for world view is: {"lat":44.71405011478421,"lng":-12.859108050774012}

	//Event Handlers for map
	// map.addListener('center_changed', function(){
	// 	var centerpoint = {
	// 		"lat": map.center.lat(),
	// 		"lng": map.center.lng()
	// 	};
	// 	//console.log("Center is now: ", JSON.stringify(centerpoint));
	// 	b2iMaps[mapID].center = centerpoint;
	// });

	// map.addListener('zoom_changed', function () {
	// 	//console.log("Zoom is now: ", map.zoom);
	// 	b2iMaps[mapID].zoom = map.zoom;
	// b2iHeatmap.set('radius',500);
	// });

	map.addListener('bounds_changed', function() {
		var centerpoint = {
			"lat": map.center.lat(),
			"lng": map.center.lng()
		};
		console.log("Bounds Zoom: ", map.zoom);
		console.log("Bounds center: " + JSON.stringify(centerpoint));
		console.log("Bounds: " + JSON.stringify(map.getBounds().toJSON()));
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
	//** [lat,lng]var re = /\[[-+]?([1-8]?\d(\.\d+)?|90(\.0+)?),\s*[-+]?(180(\.0+)?|((1[0-7]\d)|([1-9]?\d))(\.\d+)?)\]/g;
	var re = /\[[-+]?(180(\.0+)?|((1[0-7]\d)|([1-9]?\d))(\.\d+)?),\s*[-+]?([1-8]?\d(\.\d+)?|90(\.0+)?)\]/g; //Qlik format [lng,lat]
	//Loop through the dimensions and create markers
	for (let i = 0; i < dimLength; i++) {

		//Only create a single unique marker
		var uniques = getUniqueText(hCube,i);
		var heatmapMarkers = []; //Array to hold all markers for heatmap.
		uniques.forEach(function (marker,index){
			try {

				var markerObj = {};
				if(marker.row.match(re)){
					var array = JSON.parse(marker.row);
					//Note: Qlik GeoPoint is [lng,lat] format (opposite Google format)
					markerObj.lat = Number(array[1]);
					markerObj.lng = Number(array[0]);
				} else {
					markerObj = JSON.parse(marker.row);
				}

				//Do I need to validate formating?
				markerObj.config = b2iConfig;
				markerObj.map = map;

				switch (b2iConfig.mapType) {
					case "marker":
						createMarker(markerObj);
						break;
				
					case "heatmap":	
						//Todo				
						// mapData[mapData.length-1].weight = cell.qNum //Update with Measure data for a weight.
						var hasWeight = (measureLength > 0)?true:false;
						heatmapMarkers.push({
							"location":new google.maps.LatLng(markerObj.lat, markerObj.lng),
							"weight":(hasWeight)?marker.weight:1
						});						
						break;	

					case "cluster":
						//Todo
						// See Google Documentation for Cluster implementation: https://developers.google.com/maps/documentation/javascript/marker-clustering
						break;
					default:
						break;
				}
				
			} catch (error) {
				console.log("Dimension is not a Google Marker object or GeoPoint");
			}
		});

		if(b2iConfig.mapType === "heatmap"){
			var heatmapObj = {
				"heatmapMarkers" : heatmapMarkers,
				"config" : b2iConfig,
				"mapID" : mapID
			};

			createHeatmap(heatmapObj);
		}
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
	// Reference Google Marker Configurations: https://developers.google.com/maps/documentation/javascript/markers
	// debugger;
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

	if(markerObj.label) {
		gMarker.label = markerObj.label;
	}

	//Create Google Marker
	var marker = new google.maps.Marker(gMarker);

	if(markerObj.bounce) {
		marker.setAnimation(google.maps.Animation.BOUNCE);
	}

	if (markerObj.circleRadius){
		var markerCircle = new google.maps.Circle({
			center: gMarker.position,
			strokeColor: '#FF0000',
			strokeOpacity: 0.8,
			strokeWeight: 2,
			fillColor: '#FF0000',
			fillOpacity: 0.15,
			map: gMarker.map,
			radius: markerObj.circleRadius
		});
	}

	var contentString = '';
	if(markerObj.contentString){
		contentString = markerObj.contentString;

		var infowindow = new google.maps.InfoWindow({
			content:contentString
		});
	
		marker.addListener('click',function(){
			infowindow.open(gMarker.map, marker);
		})
	}
	// Example Popup--------------------------------------
	// var contentString = '<div id="content">'+
	// '<div id="siteNotice">'+
	// '</div>'+
	// '<h1 id="firstHeading" class="firstHeading">Uluru</h1>'+
	// '<div id="bodyContent">'+
	// '<p><b>Uluru</b>, also referred to as <b>Ayers Rock</b>, is a large ' +
	// 'sandstone rock formation in the southern part of the '+
	// 'Northern Territory, central Australia. It lies 335&#160;km (208&#160;mi) '+
	// 'south west of the nearest large town, Alice Springs; 450&#160;km '+
	// '(280&#160;mi) by road. Kata Tjuta and Uluru are the two major '+
	// 'features of the Uluru - Kata Tjuta National Park. Uluru is '+
	// 'sacred to the Pitjantjatjara and Yankunytjatjara, the '+
	// 'Aboriginal people of the area. It has many springs, waterholes, '+
	// 'rock caves and ancient paintings. Uluru is listed as a World '+
	// 'Heritage Site.</p>'+
	// '<p>Attribution: Uluru, <a href="https://en.wikipedia.org/w/index.php?title=Uluru&oldid=297882194">'+
	// 'https://en.wikipedia.org/w/index.php?title=Uluru</a> '+
	// '(last visited June 22, 2009).</p>'+
	// '</div>'+
	// '</div>';

}

function createHeatmap(heatmapObj){
	// console.log(heatmapObj);

	// See Google Heatmap Documentation for options: https://developers.google.com/maps/documentation/javascript/examples/layer-heatmap
	var heatmap = new google.maps.visualization.HeatmapLayer({
		data: heatmapObj.heatmapMarkers,
		dissipating: heatmapObj.config.disFlag,
		 radius:heatmapObj.config.radius,
		 //gradient:heatmapObj.config.gradient,
		 maxIntensity: heatmapObj.config.intensity,
		 opacity: heatmapObj.config.opacity, //expressed as number between 0 - 1.
		map: b2iMaps[heatmapObj.mapID].map
	});


	b2iMaps[heatmapObj.mapID].heatmap = heatmap;
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


