
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
					qWidth : 2,
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
					max : 1
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
			var hCube = layout.qHyperCube;
			var mapID = layout.qInfo.qId;
			var disFlag = layout.properties.heatmapDissipation;
			
			console.log('Dissipation?:' + disFlag);

			console.log('Google Object = ' + typeof window.google);

			// Clear out the element for refresh.
			console.log('paint: map_' + mapID);
			$element.empty();
			
			//Check for API Key existence
			if (typeof layout.properties.apikey === 'undefined' || layout.properties.apikey === ''){
				var html = '<div style="height:100%" id="map_' + mapID + '"><br><b>Please Enter your Google Maps API Key in the Settings Panel</b><br></div>';
				$element.html(html);
				return; // Do not continue with map making.
			} else {
				var html = '<div style="height:100%" id="map_' + mapID + '"></div>';
				$element.html(html);
			}
					

			if(typeof google === 'undefined'){
				console.log("Loading Google API");
				$.getScript("https://maps.googleapis.com/maps/api/js?libraries=visualization&key=" + layout.properties.apikey)
					.done(function (script, textStatus) {
						console.log(textStatus);
						initMap(hCube, mapID);
					})
					.fail(function (jqxhr, settings, exception) {
						$("#map_" + mapID).text("Error Loading Google");
					});
			} else {
				console.log("Skipping Google API load (already loaded)...");
				initMap(hCube, mapID);
			}
		}
	};
});

function initMap(hCube, mapID) {
	var uluru = {lat: -25.363, lng: 131.044};
	var chicago = {lat:41.85, lng: -87.64999999999998};
	var us = {lat:37.09024, lng:-95.712891}; //?
	var kansas = {lat:39, lng:-98};

	//Build the Map
	console.log('initMap: map_' + mapID );
	console.log('element:' + document.getElementById('map_' + mapID));
	var map = new google.maps.Map(document.getElementById('map_' + mapID), {
		// var map = new google.maps.Map(document.getElementById('map'), {
		zoom: 4, //4
		center: chicago
	});

	// //render titles
	console.log('Dimensions & Measures:');
	$.each(hCube.qDimensionInfo, function (key, value) {
		console.log("Dimensions: " + value.qFallbackTitle);
	});
	$.each(hCube.qMeasureInfo, function (key, value) {
		console.log("Measures: " + value.qFallbackTitle);
	});

	var heatmapData = [];
	var lastrow = 0;
	
	//Cycle through hypercube rows.
	$.each(hCube.qDataPages[0].qMatrix, function(rownum, row) {
		lastrow = rownum;

		//Cycle through hypercube columns
		$.each(row, function (key, cell) {
			// console.log("Key: " + key);
			// console.log("Cell: " + JSON.stringify(cell));

			//Geopoint Regular Expression match Format: [-#.#,-#.#]
			var re = /\[[-+]?([1-8]?\d(\.\d+)?|90(\.0+)?),\s*[-+]?(180(\.0+)?|((1[0-7]\d)|([1-9]?\d))(\.\d+)?)\]/g;

			//GeoPoint should be the first Dimension check and plot
			if (key === 0 && cell.qText.match(re)){ //The Dimension must be a geopoint
				// parse the Qlik Geopoint string into an array of lat, long.
				var coords = JSON.parse(cell.qText);

				// createMarker(coords,map);
				heatmapData.push({location:new google.maps.LatLng(coords[0], coords[1])});

			} else if (key === 1 && cell.qNum !== NaN){	// The Measure must be a numeric
				// Adding large amounts of data at a single location.Rendering a single WeightedLocation object 
				// with a weight of 1000 will be faster than rendering 1000 LatLng objects.
				// potentially use measures as weight.  Could aggregate the points and round the geolocations.
				console.log('Attaching the Measure as a weighted datapoint. ');
				// heatmapData[heatmapData.length-1].weight = Math.pow(2,cell.qNum);
				heatmapData[heatmapData.length-1].weight = cell.qNum;
				// console.log(heatmapData[heatmapData.length - 1]);

			} else {
				//handle the exception
				console.log("Dimension one is not a geopoint or the Measure is not a numeric value.");

			}
		});
	});

	createHeatmap(heatmapData, map);
}

function createMarker(coords,map){
	var latLng = { lat: Number(coords[0]), lng: Number(coords[1])};
	//console.log(latLng);
	// console.log(map);

	//Create Google Marker
	var marker = new google.maps.Marker({
		position: latLng,
		map: map,
	});
	// Adding title property will cause hover of title
	// title: "Hello World!"
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


