// JavaScript Document
<script type="text/javascript" src="https://maps.googleapis.com/maps/api/js?key=AIzaSyBBj-LI45_3msjM7hqaAUl1hEj0J8fgidw&libraries=places&sensor=true"></script>
//Define the Global variables
var directionsDisplay;
var directionsService = new google.maps.DirectionsService(); 
var map;  
var start;
var dest;
var placesService;
var marker;
var placeInfoWindow;
var establishmentType;
var placesSearchRequest;

//Those are the objects that need to be clean before each run
var stepIter;
var routeIter;
var legIter;
var tp_nearestEstablishmentObject;
var nearestEstablishmentObject;
var	detourTime;
var exitIter;

function initialize() {
	directionsDisplay = new google.maps.DirectionsRenderer();
	var mapOptions = {
	  center: new google.maps.LatLng(45, -93),
	  zoom: 13,
	  mapTypeId: google.maps.MapTypeId.ROADMAP
	}
	map = new google.maps.Map(document.getElementById("map-canvas"),mapOptions);
	
	directionsDisplay.setMap(map);
	
	//Add the panel that displays the turn by turn instruction, and the overall travelling time
	directionsDisplay.setPanel(document.getElementById('directions-panel'));
	
	//Initiate a placeService Object for Place Search, see later
	placesService = new google.maps.places.PlacesService(map);
	placeInfoWindow = new google.maps.InfoWindow();		
	
	
}

//The Main function of Route Calculation, called when user click "Submit"
function calcRoute(){
	//If the marker on map is already created, delete is
	if(marker!=null)
	{
		marker.setMap(null);
		marker=null;
	}
	
	//reset the global parameters
	exitIter=0;
	stepIter=0;	
	routeIter=0;
	legIter=0;
	detourTime=9999;
	tp_nearestEstablishmentObject= new Object();
	nearestEstablishmentObject= new Object();
	
	//Get the origin and destination from user input
	start = document.getElementById("origin").value;
	dest = document.getElementById("destination").value;
	
	//First, we search for the route JUST between origin and destination. We call that "the original route".
	var firstdirectonRequest={
		origin: start,
		destination: dest,
		travelMode: google.maps.TravelMode.DRIVING,
		unitSystem: google.maps.UnitSystem.METRIC,
		}	
	directionsService.route(firstdirectonRequest, function(directionsResult, status){
		if (status==google.maps.DirectionsStatus.OK){
			//In Google map api, directionResult would be the object that holds everything about the route. 
			//We are gonna parse directionResult to iterate each turns.
			IterateTurn(directionsResult);
		}				
	});		
}

function IterateTurn(directionsResult){
	//Get the type of establishment we are visiting en route from user input
	establishmentType= document.getElementById("select_enroutetask").value;
	
	//Get the START LOCATION of the route and search for the nearby establishment of selected type
	//We search the start location seperately because the start_location does not fit the general patterns of the other turn
	var searchCoord;			
	searchCoord=directionsResult.routes[routeIter].legs[legIter].start_location; //The way that Google Map organizes their direction result is as follow:
	// route[]  (which holds a set of alternative routes, if any)
	//		--legs[]	(which holds a set of routes between each pair of waypoint, if any)
	//				--step[]	(which contains the turns in turn-by-turn direction)
	

	//Construct the placeSearchRequest Object, which searches for the establishment of selected type near the Starting_Point, the result is ranked by distance to the search location 
	placesSearchRequest = {
		location: searchCoord,
		types: [establishmentType],
		rankBy: google.maps.places.RankBy.DISTANCE,
	};
	
				
	searchNearestEstablishment(placesSearchRequest,directionsResult);
	
}
 
function searchNearestEstablishment(placesSearchRequest,directionsResult){
	//This is a recursive function, in the sense that it will call it self iteratively until the place search for establishment of selected type at each turns have been done. The reason for using a recursive function, rather than a straightforward for-loop, is that Google javascript relies on callback function to process the returned object of Place Service and Direction Service query, as a result, any code after the Place Service function and Direction Service will actually be processed before the place search result and direction search (routing) result are returned. 
	
	//Doing a place search near the location given by search request object
	placesService.nearbySearch(placesSearchRequest, function(placesResults, status){
		if (status == google.maps.places.PlacesServiceStatus.OK)
		{	
			
			updatePlaceResultObject(tp_nearestEstablishmentObject,placesResults[0]); //Since the establishment of selected type at specific location is ranked by distance, so the first one is the nearest one.
			
			//Query the travel time from the nearest establishment to the current turn (we call it detour time, since it is from the nearest establishment to a turn on the original route)
			var compareDirectonRequest=
			{
				origin: placesSearchRequest.location,
				destination: tp_nearestEstablishmentObject.geometry.location,
				travelMode: google.maps.TravelMode.DRIVING,
				unitSystem: google.maps.UnitSystem.METRIC,
			}
							
			directionsService.route(compareDirectonRequest, function(compareDirectionsResult, status)
			{
				if (status==google.maps.DirectionsStatus.OK)
				{
					
					//If the detour time is smaller than the recorded minimum detour time, update the smallest detour time
					if(compareDirectionsResult.routes[0].legs[0].duration.value<detourTime)
					{
						detourTime=compareDirectionsResult.routes[0].legs[0].duration.value;
						updatePlaceResultObject(nearestEstablishmentObject,tp_nearestEstablishmentObject);
					}
					
					//Since we are not using for-loop, so we have to do the i++ job ourselves
					exitIter++;
					if(exitIter>=directionsResult.routes[routeIter].legs[legIter].steps[stepIter].lat_lngs.length)
					{
						stepIter++;		
						exitIter=0;					
						if(stepIter>=directionsResult.routes[routeIter].legs[legIter].steps.length)
						{
							legIter++;
							stepIter=0;
							if(legIter>=directionsResult.routes[routeIter].legs.length)
							{
								routeIter++;
								legIter=0;
							}
						}	
					}
					
					
					//If we finish place search at every turn, create a marker at this recorded nearest establishment and do the final routing.
					if(routeIter>=directionsResult.routes.length)
					{
						createMarker(nearestEstablishmentObject);
						finalDirectionsServiceandRender();
					}
					else	//if we have not finish places search at every turn, use next turn in the original route for nearest establishment search
					{
						searchCoord=directionsResult.routes[routeIter].legs[legIter].steps[stepIter].lat_lngs[exitIter];
						placesSearchRequest = {
							location: searchCoord,
							types: [establishmentType],
							rankBy: google.maps.places.RankBy.DISTANCE,
						};
						
						//recursively call the function itself								
						searchNearestEstablishment(placesSearchRequest,directionsResult);	
					}																																					
				}
			});		
		}
	});				
};

//Convenient function to update the place result object
function updatePlaceResultObject(tobeupdated,update){
	tobeupdated.geometry= update.geometry;
	tobeupdated.icon=update.icon;
	tobeupdated.name=update.name;
	tobeupdated.vicinity=update.vicinity;
	}

google.maps.event.addDomListener(window, 'load', initialize);

//This is the final Direction Service, which use the original start location and original end location from user input, and the nearest establishment which has the minimum detour time as waypoint.
function finalDirectionsServiceandRender(){
	var finalDirectonRequest={
		origin: start,
		destination: dest,
		travelMode: google.maps.TravelMode.DRIVING,
		unitSystem: google.maps.UnitSystem.METRIC,
		waypoints: [
		{
			location: nearestEstablishmentObject.geometry.location,
		}]
	}

	directionsService.route(finalDirectonRequest, function(finalDirectionsResult, status){
		if (status==google.maps.DirectionsStatus.OK){
			directionsDisplay.setDirections(finalDirectionsResult);
		}				
	});		
}

//Create Marker for the nearest establishment with minimum detour time.
function createMarker(place) {
  marker = new google.maps.Marker({
	map: map,
	position: place.geometry.location
  });

  google.maps.event.addListener(marker, 'click', function() {
	placeInfoWindow.setContent(place.name);
	placeInfoWindow.open(map, this);
  });
}

