const initLoc = { lat: 22.3034757, lng: 114.1602846 };
//22.3034757,114.1602846 West Kowloon, Hong Kong

var map, panorama, infoWindow;
var streetViewSrv;
var streetViewPano;
var marker = null;

/*Variables for current location*/
var currLocLatLng;
var currLocAddr;
var currLocHasVal = 0;
//var curLocName;
//var currNameAddr;

var inputFrom, autocompleteFrom, placeFrom;
var placeFromHasVal = 0;
var inputCurrLoc, autocompleteCurrLoc, placeCurrLoc;
var placeFromHasVal = 0;

var triggerSearch = 0;
var nRetrySearch = 1;
var resultArr = new Array();
var clickedId = -1;
var breakTag = "<br>";
var splittedArr = new Array();

class cafe {
  name;
  addr;
  img;
  location;
  lat; 
  lng; 
  placeId;
}

function init(){
 
  console.log("Set up Google map");
  
  //#Google Map - Set up the map.
  map = new google.maps.Map(document.getElementById("map"), {
    center: initLoc,
	disableDefaultUI: true,
    zoom: 15,
    streetViewControl: false,
	mapTypeId: 'roadmap'
	//clickableIcons: false
  });  
  
  console.log("Set up Google streetview");
    
  //#Streetview
  streetViewPano = new google.maps.StreetViewPanorama(
    document.getElementById("pano")
  );
  
  streetViewSrv = new google.maps.StreetViewService();
  // Set the initial Street View camera to the center of the map
  streetViewSrv.getPanorama({ 
    location: initLoc, 
	radius: 50,	//default=50
	}, processSVData);
  // Look for a nearby Street View panorama when the map is clicked.
  // getPanorama will return the nearest pano when the given
  // radius is 50 meters or less.
  
  //#Events for map only
  /*map.addListener("click", (event) => {
    //marker.setMap(null);
    streetViewSrv.getPanorama({ location: event.latLng, radius: 50 }, processSVData);
  });*/  

  console.log("Set up geolocation");
  
  /*#Geolocation - detect current location*/
  infoWindow = new google.maps.InfoWindow();

  if (navigator.geolocation) 
  {
    navigator.geolocation.getCurrentPosition(
      (position) => {
         const pos = {
           lat: position.coords.latitude,
           lng: position.coords.longitude,
         };
		 setCurrLocation(1, pos, null); 		 
        },
        () => {
          handleLocationError(true, infoWindow, map.getCenter());
        }
      );
  } 
  else 
  {
      // Browser doesn't support Geolocation
      handleLocationError(false, infoWindow, map.getCenter());
  }
 
  //#Autocomplete Current Location Manual Update
  inputCurrLoc = document.getElementById("input-curr-loc");
  
  autocompleteCurrLoc = new google.maps.places.Autocomplete(inputCurrLoc);
  autocompleteCurrLoc.bindTo("bounds", map);
  autocompleteCurrLoc.setFields(["address_components", "adr_address", "formatted_address", "geometry", "icon", "name", "place_id", "vicinity"]);//"html_attributions"
   
  autocompleteCurrLoc.addListener("place_changed", () => {
    placeCurrLoc = autocompleteCurrLoc.getPlace();      
	    
    if (checkGeometry(placeCurrLoc) === 0)
    {
      return;
    }
	
	var pos = {
      lat: placeCurrLoc.geometry.location.lat(),
      lng: placeCurrLoc.geometry.location.lng(),
    };
	
	setCurrLocation(0, pos, document.getElementById("input-curr-loc").value);
    clearTextValue("input-curr-loc");	
  });
  
  //#Autocomplete From Input
  inputFrom = document.getElementById("from-input");
  
  autocompleteFrom = new google.maps.places.Autocomplete(inputFrom);
  autocompleteFrom.bindTo("bounds", map);
  autocompleteFrom.setFields(["address_components", "adr_address", "formatted_address", "geometry", "icon", "name", "place_id", "vicinity"]);//"html_attributions"
   
  autocompleteFrom.addListener("place_changed", () => {
    placeFrom = autocompleteFrom.getPlace();      
	    
    if (checkGeometry(placeFrom) === 0)
    {
      return;
    }
  	
	placeFromHasVal = 1;
    setMapAndPano(placeFrom);
    //map.setCenter(placeFrom.geometry.location);
    //streetViewSrv.getPanorama({ location: placeFrom.geometry.location, radius: 50 }, processSVData);
	triggerSearch = 1;
    //console.log(placeFrom.name);	
    //setDesiredLocation(placeFrom);
    searchCafeNearBy(placeFrom, null);	  
  });
}

function searchCafeNearBy(locationObj, strKeyword) {
  
  var errMsg;
  var errMsgCurrLoc = "Update your current location from autocomplete dropdown / allow location detection"; 
  var delimt = " | ";
  var errMsgPlcFrom = "Type & select a valid place from autocomplete dropdown";
 
try
{ 
	
  if (currLocHasVal === 0)
  {   
	if (placeFromHasVal === 0)
	{
	  errMsg = errMsgCurrLoc + delimt + errMsgPlcFrom;
	}
	else
	{
	  errMsg = errMsgCurrLoc;
	}
	
	showSnackBar(2, errMsg, 0);
	//document.getElementById("input-curr-loc").scrollIntoView();
	
    //clearTextValue("from-input");
	
    return;
  }
  
  if (placeFromHasVal === 0)
  {
    errMsg = errMsgPlcFrom;
	
	showSnackBar(2, errMsg, 0);
	document.getElementById("from-input").scrollIntoView();
	
    //clearTextValue("from-input");
	
    return;
  }
  
  var placeService = new google.maps.places.PlacesService(map);
  var currentLocation =  new google.maps.LatLng(parseFloat(currLocLatLng.lat), parseFloat(currLocLatLng.lng));
   
  var keyword = "cafe";
  
  if (strKeyword === null)
  { 
    if (locationObj.place_id)
	{
	  //#test
	  //locationObj.place_id=null;
      
	  const request = {
        location: locationObj.geometry.location,
        fields: ["name", "formatted_address", "place_id", "geometry"],
	    placeId: locationObj.place_id,
      };
    
      placeService.getDetails(request, (place, status) => {
        if ( status === google.maps.places.PlacesServiceStatus.OK && place && place.geometry && place.geometry.location) 
	    {
          if (place.name)
	      {
	        keyword = place.name;
		    console.log(keyword);
	      
		
            let requestNearbyDef = {
              location: currentLocation,
	          radius: '10000',
	          type: ['cafe'],
	          keyword: keyword,
			  name: keyword,
			  //name: //Restricts the Place search results to Places that include this text in the name.
	          fields: ["address_components", "adr_address", "formatted_phone_number", "formatted_address", "geometry", "icon", "name", "place_id", "vicinity", "website", "opening_hours"]
            };	
	        
			console.log ("requestNearbyDef");
			
            document.getElementById("keyword-text").innerHTML = keyword;
			splitKeyword(keyword);
	        //clearTextValue("input-keyword");
            placeService.nearbySearch(requestNearbyDef, nearbyCallback);
		  }
	    }
		else
		{
		  console.log(status.toString());		
		}
      }); 
	}
  }
  else
  {
    if (strKeyword)
	{
      keyword = strKeyword;
	}
  
    console.log(keyword);
    console.log ("requestNearby");
			
    let requestNearby = {
      location: currentLocation,
	  radius: '10000',
	  type: ['cafe'],
	  keyword: keyword,
	  name: keyword,
	  fields: ["address_components", "adr_address", "formatted_phone_number", "formatted_address", "geometry", "icon", "name", "place_id", "vicinity", "website", "opening_hours"]
    };	
	
    document.getElementById("keyword-text").innerHTML = keyword;
    splitKeyword(keyword);
    //clearTextValue("input-keyword");
    placeService.nearbySearch(requestNearby, nearbyCallback);  
  }
 }
 catch (err)
 {
   console.log("Exception in searchCafeNearBy");
   console.log(err.toString());
   
   updateCafeNearbyText(0);
   
   var errMsg = "Unexpected error. Please try again";
	
   showSnackBar(2, errMsg, 0);   
 } 
}

// Handle the results from Nearby Search
function nearbyCallback(results, status) {
  if ((status == google.maps.places.PlacesServiceStatus.OK) || (status == google.maps.places.PlacesServiceStatus.ZERO_RESULTS)) {
    
	console.log(results);
	
	//if (triggerSearch === 1)
	//{
	  clearListRes();
	
	  var size = results.length;
	  updateCafeNearbyText(size);
   	
	  //#Enhanced
	  if (size > 0)
	  {  	  
	    console.log("size > 0");
		
	    triggerSearch = 0;
		nRetrySearch = 1;
	   
	    console.log("list nearby cafe");
		
	    listCafeNearby(results);
	  }
	  else
	  {
	    console.log("size <= 0");
		console.log(nRetrySearch.toString());
		
	    var splittedArrsize = splittedArr.length;
		console.log("splittedArrsize: "+ splittedArrsize.toString());
		
	    if ((nRetrySearch <= 2) && (splittedArrsize > 1))
	    {
	      //Re-trigger search
		  var newKeyword;          
          var sizeToLoop = splittedArrsize - 1;
		
		  for (var e = 0; e < sizeToLoop; e ++)
		  {
		    if (e > 0)
		    {
		      newKeyword = newKeyword + " " + splittedArr[e];
			  console.log(newKeyword);
			  console.log("e > 0");
		    }
		    else
		    {
		      newKeyword = splittedArr[e];
			  console.log(newKeyword);
		    }
		  }
		  nRetrySearch = nRetrySearch + 1;
	      updKeywordSearch(newKeyword);    
	    }
	    else
	    {
	      nRetrySearch = 1;
		  triggerSearch = 0;
	    }	
	  }
	//}
  }
  else
  {
    console.log(status);
	
	//if (triggerSearch === 1)
	//{
	  clearListRes();
	  
      var errMsg = "No result found. Update keyword/Search again";
      showSnackBar(2, errMsg, 0);
	  
	  nRetrySearch = 1;
	  triggerSearch = 0;
	  
	  updateCafeNearbyText(0);
	  //clearTextValue("from-input");
	//}
  }
}

function updateCafeNearbyText(count)
{
  //For the top message
  var dispTxt;
  var txtStart = "&nbsp;&#47;&nbsp;";
  var singularTxtEnd = "&nbsp;similar cafe nearby";
  var pluralTxtEnd = "&nbsp;similar cafes nearby";
  
  /*  <h6 id="similar-cafe-text">
		<b>&nbsp;&nbsp;n&#47;a&nbsp;similar cafes, within 10km of:</b>
		<br>
		<br>
		<i style="color:#ffffff"><b>&nbsp;&nbsp;n&#47;a</b></i>
	  </h6>*/
  //Bottom message  
  var resultTxt;
  var resultTxtStart = "<b>&nbsp;&nbsp;";
  var resultTxtPluralSec = "&nbsp;similar cafes within 10km of:</b><br><br><i style='color:#ffffff'><b>&nbsp;&nbsp;";
  var resultTxtSingularSec = "&nbsp;similar cafe within 10km of:</b><br><br><i style='color:#ffffff'><b>&nbsp;&nbsp;";
  var resultTxtEnd = "</b></i>";
  
  dispTxt = txtStart;
  
  if ((count === 0) || (count === 1))
  {
    dispTxt = dispTxt + count.toString() + singularTxtEnd;
	//n&#47;a<b>&nbsp;=&nbsp;</b>n&#47;a
    resultTxt = resultTxtStart + count.toString() + resultTxtSingularSec + currLocAddr + resultTxtEnd;  
  }
  else
  {
    dispTxt = dispTxt + count.toString() + pluralTxtEnd;
	resultTxt = resultTxtStart + count.toString() + resultTxtPluralSec + currLocAddr + resultTxtEnd;
  }
  
  console.log(dispTxt);
  console.log(resultTxt);
  
  document.getElementById("cafe-icon").innerHTML=dispTxt;
    
  document.getElementById("similar-cafe-text").innerHTML=resultTxt;
}

function listCafeNearby(results)
{  
   var size = results.length;
   var lastIndex = size - 1;
   var mod = 1;
   var listResult = document.getElementById("listRes");
   var defaultTxt = "n/a";
   var txtEmpty = "";
   var txtSpace = "&nbsp;";
   
   var topRowArr = new Array();
   var arrCnt = -1;   
   
   /*constructor(name, year) {
    this.name = name;
    this.year = year;
  }*/
   clearListRes();
   /*while (listResult.firstChild) {
      listResult.removeChild(listResult.lastChild);
   }*/
  resultArr.splice(0, resultArr.length);
  
  for (var i = 0; i < size; i++) {
    
	var cafeObj = new cafe();
	
    //<div class="col-lg-3">
	var divColLgTop = document.createElement("div");
	divColLgTop.setAttribute("class", "col-lg-3");
	
	//<div class="card" style="width: 100%; height: 60vh">
	var divCard = document.createElement("div");
	divCard.setAttribute("class", "card");
	divCard.setAttribute("style", "width: 100%; height: 65vh");
	
    //<img class="img-fluid" src="./images/images-orange.jpg" style="width: 100%; height: 25vh" alt="Image">
	var aImg = document.createElement("a");	 
	aImg.setAttribute("href","#");
	var img = document.createElement("img");
    img.setAttribute("class", "img-fluid");
	var idImgStr = i.toString();
	img.setAttribute("id", "img");
	var paraIMg = "getDetails(" + idImgStr + ")";
	img.setAttribute("onclick", paraIMg);
	img.setAttribute("style", "width: 100%; height: 25vh");
	//img.setAttribute("onclick", "getDetails()");
	img.setAttribute("alt", "Image"); //src:  <img class="img-fluid" style="width: 100%; height: 25vh" alt="Image" src="./images/images-orange.jpg" >
	
	var divAttr = document.createElement("div");
	divAttr.setAttribute("class", "attr");	
	var supImg = document.createElement("sup");
	//supImg.setAttribute("style", "color:#4e4f4f");
	var txtPhoto = "Photo by&nbsp;";
	supImg.innerHTML = defaultTxt;
	divAttr.setAttribute("style", "color:#ffffff00");
	var imgSrcCont = "./assets/img/bg-img-travel-bug.jpg";
	if (results[i].photos)
	{
	  var photoLength = 0;
	  photoLength = results[i].photos.length;
	  if (photoLength > 0 )
	  {  //html_attributions
	     //img.setAttribute("src", results[i].photos[0].html_attributions[0];
		 var imgSrc = results[i].photos[0].getUrl();
	     img.setAttribute("src", imgSrc);
		 cafeObj.img = imgSrc;
         //<div class="attr" style="color:#d1cbcb">
         //  <sup>		
         //    <a  href="https://maps.google.com/maps/contrib/110491459077609355847">Sem Sem</a>
		 //    <a  href="https://maps.google.com/maps/contrib/110491459077609355847">Sem Sem</a>
		 //    <a  href="https://maps.google.com/maps/contrib/110491459077609355847">Sem Sem</a>
         //  </sup>
		 //</div>	
         //results[i].photos[0].html_attributions.push("<a  href='https://maps.google.com/maps/contrib/110491459077609355847'>Sem Sem</a>");		 
	     if (results[i].photos[0].html_attributions)
		 {  
		    var sizeArr = results[i].photos[0].html_attributions.length;
			
			if (sizeArr > 0)
			{
			  divAttr.setAttribute("style", "color:#4e4f4f");
			  supImg.innerHTML = txtPhoto;
			}
			
			for (k = 0; k < sizeArr; k++)
			{
			  supImg.innerHTML = supImg.innerHTML + results[i].photos[0].html_attributions[k] + txtSpace;
			}
	     }
	 }
	 else
	 {
	   img.setAttribute("src", imgSrcCont);
	   cafeObj.img = imgSrcCont;
	 }
	}
	else
	{
	   img.setAttribute("src", imgSrcCont);
	   cafeObj.img = imgSrcCont;
	}	 
	 //aImg.appendChild(img);
	 //var aBtn = document.createElement("a");
	 //aBtn.setAttribute("href", "#");
	 //aBtn.setAttribute("class", "btn btn-info");
	 //var iCafe = document.createElement("i");
	 //iCafe.setAttribute("class", "fas fa-coffee");
	 divAttr.appendChild(supImg);
	 
	 //<div class="card-body">
	 var aCardBody = document.createElement("a");	 
	 aCardBody.setAttribute("href","#");
	 aCardBody.setAttribute("style", "width: 100%; height: 100%");
	 //aCardBody.setAttribute("style", "color:#000000");
	 var cardBody = document.createElement("div");
	 cardBody.setAttribute("class", "card-body");
	 cardBody.setAttribute("style", "width: 100%; height: 100%");
	 var idCdBdStr = i.toString();
	 var cardBodyId = "card-body" + idCdBdStr;
	 cardBody.setAttribute("id", cardBodyId);
	 var paraCdBd = "getDetails(" + idCdBdStr + ")";
	 cardBody.setAttribute("onclick", paraCdBd);
	 //cardBody.setAttribute("style", "width: 100%; height: auto");
	 
	 //<h5 id="place-name">PlaceName0</h5>
	 var placeNm = document.createElement("h5");
	 placeNm.setAttribute("id", "place-name");
	 var boldPlaceNm = document.createElement("b");
	 if (results[i].name)
	 {
	   //results[i].name = "gakdakjhfjahaljfafalfsajlafjlfsagakdakjhfjahaljfafalfsajlafjlfsagakdakjhfjahaljfafalfsajlafjlfsagakdakjhfjahaljfafalfsajlafjlfsagakdakjhfjahaljfafalfsajlafjlfsagakdakjhfjahaljfafalfsajlafjlfsagakdakjhfjahaljfafalfsajlafjlfsa";
	   boldPlaceNm.innerHTML = truncate(results[i].name, 50);
	 }
	 else
	 {
	   boldPlaceNm.innerHTML = defaultTxt;
	 }
	 cafeObj.name = boldPlaceNm.innerHTML;
	 placeNm.appendChild(boldPlaceNm);
	 //console.log("PlaceName length: " + boldPlaceNm.innerHTML.length.toString() +);
	 //<h6 id="place-addr">Placeaddress</h6>		    
	 var placeAddr = document.createElement("h6");
	 placeAddr.setAttribute("id", "place-addr");
	 if (results[i].formatted_address)
	 {
	   placeAddr.innerHTML = truncate(results[i].formatted_address, 130);
	 }
	 else if (results[i].vicinity)
	 {
	   //results[i].vicinity = "gakdakjhfjahaljfafalfsajlafjlfsagakdakjhfjahaljfafalfsajlafjlfsagakdakjhfjahaljfafalfsajlafjlfsagakdakjhfjahaljfafalfsajlafjlfsagakdakjhfjahaljfafalfsajlafjlfsagakdakjhfjahaljfafalfsajlafjlfsagakdakjhfjahaljfafalfsajlafjlfsa";
	   placeAddr.innerHTML = truncate(results[i].vicinity, 130);
	 }
	 else
	 {
	   placeAddr.innerHTML = txtEmpty;
	 }
	 cafeObj.addr = placeAddr.innerHTML;
	 //<h6 id="website"><i class="fas fa-globe"></i><a href="url">&nbsp;Website</a></h6>
	 /*var website = document.createElement("h6");
	 website.setAttribute("id", "website");
	 var globeIcon = document.createElement("i");
	 globeIcon.setAttribute("class", "fas fa-globe");
	 var aUrl = document.createElement("a");	 
	 if (results[i].website)
	 {
	   aUrl.setAttribute("href",results[i].website);
	   aUrl.innerHTML = txtSpace + results[i].website;
	 }
	 else
	 {  
	   //aUrl.setAttribute("href",defaultTxt);
	   aUrl.innerHTML = txtSpace + defaultTxt;
	 }
	 website.appendChild(globeIcon);
	 website.appendChild(aUrl);*/
	 
	 //<h6 id="phone-no"><i class="fas fa-phone"></i>&nbsp;Phone No.</h6>
	 /*var phoneNo = document.createElement("h6");
	 phoneNo.setAttribute("id", "phone-no");*/
	 //var phoneIcon = document.createElement("i");
	 //phoneIcon.setAttribute("class", "fas fa-phone");
	 //phoneNo.appendChild(phoneIcon);
	 /*var phoneIcon = "<i class='fas fa-phone'></i>";
	 if (results[i].formatted_phone_number)
	 {
	   phoneNo.innerHTML = phoneIcon + txtSpace + results[i].formatted_phone_number;
	 }
	 else
	 {
	   phoneNo.innerHTML = phoneIcon + txtSpace + defaultTxt;
	 }*/
	 	 
	 //<div class="row">
	 var divRowInner = document.createElement("div");
	 divRowInner.setAttribute("class", "row");
	 //<div class="col-lg-6">
	 var divColLgA = document.createElement("div");
	 divColLgA.setAttribute("class", "col-lg-6");
	 //<h6 id="open-now"><i class="fas fa-clock"></i>&nbsp;Open Now</h6>
	 var hA = document.createElement("h6");
	 hA.setAttribute("id", "open-now");
	 var iA = document.createElement("i");
	 //iA.setAttribute("class", "fas fa-clock");
	 //hA.appendChild(iA);
	 var iA = "<i class='fas fa-info-circle'></i>";
	 if (results[i].business_status)
	 {
	   hA.innerHTML = iA + txtSpace + results[i].business_status.toString();
	 }
	 else
	 {
	   hA.innerHTML = iA + txtSpace + defaultTxt;
	 }
	 //<div class="col-lg-3">
	 var divColLgB = document.createElement("div");
	 divColLgB.setAttribute("class", "col-lg-3");
	 //<h6 id="price-level"><i class="fas fa-dollar-sign"></i><i class="fas fa-dollar-sign"></i><i class="fas fa-dollar-sign"></i><i class="fas fa-dollar-sign"></i><i class="fas fa-dollar-sign"></i></h6>
	 var hB = document.createElement("h6");
	 hB.setAttribute("id", "price-level");
	 if (results[i].price_level)
	 {
	   var priceLvl = results[i].price_level + 1;
	   for (var j = 0; j < priceLvl; j++)
	   {
	     var iB = document.createElement("i");
	     iB.setAttribute("class", "fas fa-dollar-sign");
	     hB.appendChild(iB);
	   }
	 }
	 //<div class="col-lg-3">
	 var divColLgC = document.createElement("div");
	 divColLgC.setAttribute("class", "col-lg-3");
	 //<h6 id="rating"><i class="fas fa-star"></i>&nbsp;4.5</h6>
	 var hC = document.createElement("h6");
	 hC.setAttribute("id", "rating");
	 var iC = document.createElement("i");
	 //iC.setAttribute("class", "fas fa-star");
	 //hC.appendChild(iC);
	 var iC = "<i class='fas fa-star'></i>";
	 if (results[i].rating)
	 {
	   hC.innerHTML = iC + txtSpace + results[i].rating.toString();
	 }
	 else
	 {
	   hC.innerHTML = iC + txtSpace + defaultTxt;
	 }
	 
	 //<div class="attr" style="color:#d1cbcb">
     //  <sup>		
     //    <a  href="https://maps.google.com/maps/contrib/110491459077609355847">Sem Sem</
	 //    <a  href="https://maps.google.com/maps/contrib/110491459077609355847">Sem Sem</a>
     //    <a  href="https://maps.google.com/maps/contrib/110491459077609355847">Sem Sem</a>
     //  </sup>
     //</div>
     var divAttrPlace = document.createElement("div");
	 divAttrPlace.setAttribute("class", "attr");	
	 var supPlace = document.createElement("sup");
	 //supImg.setAttribute("style", "color:#4e4f4f");
	 var txtPlace = "Place by&nbsp;";
     //results[i].html_attributions.push("<a  href='https://maps.google.com/maps/contrib/110491459077609355847'>Sem Sem</a>");	 
     //results[i].html_attributions.push("<a  href='https://maps.google.com/maps/contrib/110491459077609355847'>Sem Sem</a>");	 
	 
	 supPlace.innerHTML = defaultTxt;
	 divAttrPlace.setAttribute("style", "color:#ffffff00");
	 
	 if (results[i].html_attributions)
	 { 			
		var sizeArrPlc = results[i].html_attributions.length;
		
		if (sizeArrPlc > 0)
		{
		  supPlace.innerHTML = txtPlace;
		  divAttrPlace.setAttribute("style", "color:#4e4f4f");
		}
		
		for (w = 0; w < sizeArrPlc; w++)
		{
		  supPlace.innerHTML = supPlace.innerHTML + results[i].html_attributions[w] + txtSpace;
		}
	 }	 	 
	 divAttrPlace.appendChild(supPlace);
	 	 
	 divColLgA.appendChild(hA);
	 divRowInner.appendChild(divColLgA);
	 
	 divColLgB.appendChild(hB);
	 divRowInner.appendChild(divColLgB);
	 
	 divColLgC.appendChild(hC);
	 divRowInner.appendChild(divColLgC);
	 
	 cardBody.appendChild(placeNm);
	 cardBody.appendChild(placeAddr);
	 //cardBody.appendChild(website);
	 //cardBody.appendChild(phoneNo);
	 cardBody.appendChild(divRowInner);
	 //cardBody.appendChild(htmlAttr);
	 
	 //aBtn.appendChild(iCafe);
	 //img.appendChild(aBtn);
	 aImg.appendChild(img);
     aCardBody.appendChild(cardBody);	 
	 divCard.appendChild(aImg);
	 divCard.appendChild(divAttr);
	 divCard.appendChild(aCardBody);
	 divCard.appendChild(divAttrPlace);
	 
	 /*var aCard = document.createElement("a");	 
	 aCard.setAttribute("href","#");
	 var idCdStr = i.toString();
	 divCard.setAttribute("id", "card");
	 var paraCd = "getDetails(" + "'" + idCdStr + "'" + ")";
	 divCard.setAttribute("onclick", paraCd);
	 aCard.appendChild(divCard);*/
	 
	 divColLgTop.appendChild(divCard);
	 
	 mod = i % 4;
	 
	 if (mod === 0)
	 {
	    var divRowTop = document.createElement("div");
	    divRowTop.setAttribute("class", "row");
		topRowArr.push(divRowTop);
		
		arrCnt = arrCnt + 1;
	 }
	 topRowArr[arrCnt].appendChild(divColLgTop);		
		 
	
	 if (i === lastIndex)
	 { 
	    var arrSize = topRowArr.length;
	    for (var g = 0; g < arrSize; g++)
		{
		  listResult.appendChild(topRowArr[g]);		
		}
	    console.log(listResult);
     }
	 
	 if (results[i].geometry.location)
	 {
	   cafeObj.location = results[i].geometry.location;
	   cafeObj.lat = results[i].geometry.location.lat();
	   cafeObj.lng = results[i].geometry.location.lng();
	 }
	 
	 if (results[i].place_id)
	 {
	   cafeObj.placeId = results[i].place_id;
	 }
	 
	 resultArr.push(cafeObj);
   }
   console.log(resultArr);
}

function getDetails(id) {
 try
 {
   console.log("getDetails");
   console.log(id);
  
   let requestDetails = {
     placeId: resultArr[id].placeId,
	 fields: ["address_components", "adr_address", "formatted_phone_number", "formatted_address", "geometry", "icon", "name", "place_id", "vicinity", "website", "opening_hours"]
   };
  
   var placeServiceGetDetails = new google.maps.places.PlacesService(map);
   placeServiceGetDetails.getDetails(requestDetails, detailsCallback);
  
   clickedId = id; 
 }
 catch(err) {
   clickedId = -1;
   
   console.log(err.toString());
   
   var errMsg = "Unexpected error. Please try again";
	
   showSnackBar(2, errMsg, 0);   
 }  
}

function detailsCallback(results, status)
{
  var txtEmpty = "";
  var txtSpace = "&nbsp;";
  var startBold = "<b>";
  var endBold = "</b>";
  var breakTag = "<br>";
  var id = clickedId;
  var addrIcon = "<i class='fas fa-map-marker-alt'></i>";
  var opHourIcon = "<i class='fas fa-clock'></i>";
  var opHourIconInv = "<i class='fas fa-clock' style='color:#ffffff00'></i>";
  var websiteIcon = "<i class='fas fa-globe'></i>";
  var phoneNumIcon =  "<i class='fas fa-phone'></i>";
  
  if (status == google.maps.places.PlacesServiceStatus.OK) {
    
    console.log(results);
	
	setMapAndPanoLocationObj(resultArr[id].location);

	var placeName = document.getElementById("det-name");
	placeName.innerHTML = txtEmpty;
	var placeAddr = document.getElementById("det-addr");
	placeAddr.innerHTML = txtEmpty;
	var placeOpeningHour = document.getElementById("det-opening hour");
	placeOpeningHour.innerHTML = txtEmpty;
	var placeWebsite = document.getElementById("det-website");
	placeWebsite.innerHTML = txtEmpty;
	var placePhoneNum = document.getElementById("det-phone-num");
	placePhoneNum.innerHTML = txtEmpty;
	var placeHtmlAddr = document.getElementById("det-html-attr");
	placeHtmlAddr.innerHTML = txtEmpty;
	 
	if (results.name)
	{
	  placeName.innerHTML = startBold + results.name + endBold;
	}
	else
	{
	  placeName.innerHTML = startBold + resultArr[id].name + endBold;
	}
	 
	if (results.formatted_address)
	{
	  placeAddr.innerHTML = addrIcon + txtSpace + txtSpace + results.formatted_address;
	}
	else if (results.vicinity)
	{
	  placeAddr.innerHTML = addrIcon + txtSpace + txtSpace + results.vicinity;
	}
	else
	{
	  placeAddr.innerHTML = addrIcon + txtSpace + txtSpace + resultArr[id].addr;
	}
	 
	if (results.opening_hours)
	{
	  if (results.opening_hours.weekday_text)
	  {
	    var size = results.opening_hours.weekday_text.length;
	    var lastIndex = size - 1;
		 
	    for (var t = 0; t < size; t++)
		{
		  if (t === lastIndex)
		  {
		  	placeOpeningHour.innerHTML = placeOpeningHour.innerHTML + opHourIconInv + txtSpace + txtSpace+ results.opening_hours.weekday_text[t]; 
		  }
		  else
		  {
		    if (t === 0)
			{
			  placeOpeningHour.innerHTML = opHourIcon +  breakTag;
			}
		    placeOpeningHour.innerHTML = placeOpeningHour.innerHTML + opHourIconInv + txtSpace + txtSpace + results.opening_hours.weekday_text[t] + breakTag;
		  }
	    }
	  }
    }
	 
	if (results.website)
	{
	   var url = document.createElement("a");
	   url.setAttribute("href", results.website);
	   url.setAttribute("style", "color:#ffffff");
	   url.setAttribute("target", "_blank");
	   url.innerHTML = websiteIcon + txtSpace + txtSpace + results.website;
	   placeWebsite.appendChild(url);
	}
	 
	if (results.formatted_phone_number)
	{
	   placePhoneNum.innerHTML = phoneNumIcon + txtSpace + txtSpace + results.formatted_phone_number;
	}
	 
	var txtPlace = "Place by";
    //results[i].html_attributions.push("<a  href='https://maps.google.com/maps/contrib/110491459077609355847'>Sem Sem</a>");	 
    //results[i].html_attributions.push("<a  href='https://maps.google.com/maps/contrib/110491459077609355847'>Sem Sem</a>");	 
	 
	if (results.html_attributions)
    {  		 
	    var size = results.html_attributions.length;
	    var lastIndex = size - 1;
		if (size > 0)
		{
		  placeHtmlAddr.innerHTML = txtPlace + breakTag;
		  
	      for (var a = 0; a < size; a++)
		  {
		    if (a === lastIndex)
		    {
		  	  placeHtmlAddr.innerHTML = placeHtmlAddr.innerHTML + results.html_attributions[a]; 
		    }
		    else
		    {
		      placeHtmlAddr.innerHTML = placeHtmlAddr.innerHTML + results.html_attributions[a] + breakTag;
		    }
	      }
		}
	 }
     document.getElementById("pano").scrollIntoView();	 
     show('popup2');
  }
  else
  {
    console.log(status.toString());
	clickedId = -1;
	
	var errMsg = "No result found.";
    showSnackBar(2, errMsg, 0);
  }
}

/**/
function show(id)
{
  console.log("show");
  console.log(id);
  document.getElementById(id).style.display ='block';
}

function hide(id)
{
  console.log("hide");
  console.log(id);
  document.getElementById(id).style.display ='none';
  var cardBodyId = "card-body" + clickedId.toString();
  document.getElementById(cardBodyId).scrollIntoView();   
  
  clickedId = -1;
}

function splitKeyword(keyword)
{
  splittedArr.splice(0, splittedArr.length);
  
  var keywordSplilt = keyword.split(" ");
  var length = keywordSplilt.length;
  
  for (var d = 0; d < length; d++)
  {
    splittedArr.push(keywordSplilt[d]);
  }
  
  for (var w = 0; w < length; w++)
  {
    console.log(keywordSplilt[w]);
  }
}

function updKeywordSearch(keyword)
{ 
  triggerSearch = 1;
  //searchCafeNearBy(placeFrom, document.getElementById("input-keyword").value);
  searchCafeNearBy(placeFrom, keyword);
}

/***************/
function clearTextValue(idStr)
{
  document.getElementById(idStr).value = "";
}

function truncate(str, n){
  return (str.length > n) ? str.substr(0, n-1) + '&nbsp;&hellip;' : str;
}

function clearListRes()
{
  var listResult = document.getElementById("listRes");
  
  while (listResult.firstChild) {
      listResult.removeChild(listResult.lastChild);
   }
}

function setMapAndPano(place) {
  
  map.setCenter(place.geometry.location);
  	
  //console.log(place.geometry.location.lat().toString() + "," + place.geometry.location.lng().toString());
	 
  streetViewSrv.getPanorama({ location: place.geometry.location, radius: 50 }, processSVData);

}

function setMapAndPanoLocationObj(locationObj) {
  
  map.setCenter(locationObj);
  streetViewSrv.getPanorama({ location: locationObj, radius: 50 }, processSVData);

}

function checkGeometry(place) {
  
  if (!place.geometry) {
    // User entered the name of a Place that was not suggested and
    // pressed the Enter key, or the Place Details request failed.
    //window.alert("No details found for input: '" + place.name + "'");
	var strErr = "No details found for input: '" + place.name + "'." + "Please select from autocomplete dropdown to search";
	showSnackBar(2, strErr, 0);
	
	clearTextValue("from-input");
 
	return 0;
  }
  else
  {
    return 1;
  }
}

function handleLocationError( browserHasGeolocation, infoWindow, pos) 
{
  infoWindow.setPosition(pos);
  infoWindow.setContent(
    browserHasGeolocation
      ? "Geolocation service not allowed/failed."
      : "Your browser doesn't support geolocation."
  );
  infoWindow.open(map);
  setCurrLocation(0, pos, null)
}

function setCurrLocation(mode, pos, strText) {
   
   currLocAddr = "n/a";
   currLocLatLng = pos;
   
   var currLocTxt = document.getElementById("curr-loc-text");  
   
   if (mode === 0)//no reverse geocoding required
   { 
     if (strText === null)
     { 
       if (currLocHasVal === 0)
       {	   
         setCurrLocColour(0);	
         currLocTxt.innerHTML = currLocAddr;		 
		 
	     //currLocTxt.scrollIntoView(); 
	   }
     }
	 else 
	 {
	   setCurrLocColour(1);
	   currLocAddr = strText;
	   currLocTxt.innerHTML = currLocAddr;
	   currLocHasVal = 1;
	   
	   //currLocTxt.scrollIntoView();	   
	 }
	 
	 return;
   }
   
   var geocoder = new google.maps.Geocoder();
   
   const latlng = {
    lat: parseFloat(currLocLatLng.lat),
    lng: parseFloat(currLocLatLng.lng),
   };
   
   geocoder.geocode({ location: latlng }, (results, status) => {
    if (status === "OK") {
      if (results[0]) 
	  {
	    if (results[0].formatted_address) 
        {
          currLocAddr = results[0].formatted_address;
          setCurrLocColour(1);
		  currLocHasVal = 1;
        }
		else
		{
		  console.log("No formatted address found after reverse geocoding");
		  setCurrLocColour(0);
		  currLocHasVal = 0;
		}
      } 
	  else 
	  {
        console.log("No result found after reverse geocoding");
		setCurrLocColour(0);
		currLocHasVal = 0;
      }
    } 
	else 
	{
      console.log("Reverse geocoding failed due to: " + status);
	  setCurrLocColour(0);
	  currLocHasVal = 0;
    }
	
	currLocTxt.innerHTML = currLocAddr;
    //currLocTxt.scrollIntoView(); 
  });    
}

function setCurrLocColour(bChange) {
  var btn = document.getElementById("curr-loc-icon");

  if (bChange === 1)
  {
     btn.setAttribute("style", "color:#009933");	 
  }
  else if (bChange === 0)
  {
     btn.setAttribute("style", "color:#d7426e");	 
  }
}

function processSVData(data, status) {
  if (status === "OK"){
    const location = data.location;
    //map
	if (marker != null)
	{
	  marker.setMap(null);
	  marker = null;
	}
    marker = new google.maps.Marker({
      position: location.latLng,
      map,
      title: location.description,
	  animation: google.maps.Animation.DROP,
    });
	
	//streetview
    streetViewPano.setPano(location.pano);
    streetViewPano.setPov({
      heading: 270,
      pitch: 0,
    });
	
    streetViewPano.setVisible(true);
    marker.addListener("click", () => {
      const markerPanoID = location.pano;
      // Set the Pano to use the passed panoID.
      streetViewPano.setPano(markerPanoID);
      streetViewPano.setPov({
        heading: 270,
        pitch: 0,
      });
      streetViewPano.setVisible(true);
    });
  } 
  else 
  {
    var errStr = "Street View data not found for this location.";
    console.error(errStr);
	
	showSnackBar(0, errStr, 0);
  }
}

function showSnackBar(mode, msgStr, secFac) 
{
  var x = document.getElementById("snackbar");
  var sec = 3000;
  
  if ((secFac === 0) || (secFac < 0))
  {
    sec = 3000;
  }
  /*else
  {
    sec = secFac*1000; //not in use now. To be further tested
  }*/
  
  if (mode === 0) //info (black)
  {
    x.setAttribute("style", "color:#FFFFFF; background-color:#000000");
  }
  else if (mode === 1) //success (green)
  {
    x.setAttribute("style", "color:#FFFFFF; background-color:#009933");
  }
  else if (mode === 2) //error (red)
  {
    x.setAttribute("style", "color:#FFFFFF; background-color:#fc0b03");
  }
  
  x.className = "show";
  x.innerHTML = msgStr;
  
  setTimeout(function()
  { 
    x.className = x.className.replace("show", ""); 
  }, sec);
}
