//begin script when window loads
(function(){

//psuedo-global variables
var attrArray = ['med_hh_inc_2015',
                'med_hh_inc_2016',
                'med_hh_inc_2017',
                'med_hh_inc_2018',
                'med_hh_inc_2019',
                'med_hh_inc_2020',
                'med_hh_inc_2021'];

var expressed = attrArray[6];  //initial attribute; set at pop2021

//chart frame dimensions
var chartWidth = window.innerWidth * 0.425,
    chartHeight = 473,
    leftPadding = 40,
    rightPadding = 2,
    topBottomPadding = 5,
    chartInnerWidth = chartWidth - leftPadding - rightPadding,
    chartInnerHeight = chartHeight - topBottomPadding * 2,
    translate = "translate(" + leftPadding + "," + topBottomPadding + ")";

//create a scale to size bars proportionally to frame and for axis
var yScale = d3.scaleLinear()
    .range([463, 0])
    .domain([0, 125000]);

window.onload = setMap();

//set up choropleth map
function setMap(){

    //map frame dimensions
    var width = window.innerWidth * 0.5,
        height = 460;

    //create new svg container for the map
    var map = d3.select('body')
        .append('svg')
        .attr('class', 'map')
        .attr('width', width)
        .attr('height', height);

    //create Albers equal area conic projection centered on Chicago region
    var projection = d3.geoAlbers()
        .center([1.25, 41.75]) // center on Chicago region
        .rotate([89.5, 0]) // rotate to the longitude of Illinois
        .parallels([37, 45]) // standard parallels for Illinois
        .scale(15000)
        .translate([width / 2, height / 2]);

    var path = d3.geoPath()
        .projection(projection);

    //use Promise.all to parallelize asynchronous data loading
    var promises = [];    
    promises.push(d3.csv('data/chicagoland_county_med_hh_inc.csv')); //load attributes from csv    
    promises.push(d3.json('data/UnitedStates.topojson')); //load US basemap
    promises.push(d3.json('data/il_counties_wgs84.topojson')); //load IL counties basemap
    promises.push(d3.json('data/chicagoland_counties_wgs84.topojson')); //load choropleth spatial data    
    Promise.all(promises).then(callback);

    function callback(data) {
        //create graticule generator
        var graticule = d3.geoGraticule()
        .step([1, 1]); //place graticule lines every 5 degrees of longitude and latitude

        //create graticule background
        var gratBackground = map.append("path")
        .datum(graticule.outline()) //bind graticule background
        .attr("class", "gratBackground") //assign class for styling
        .attr("d", path) //project graticule

        //create graticule lines
        var gratLines = map.selectAll(".gratLines") //select graticule elements that will be created
            .data(graticule.lines()) //bind graticule lines to each element to be created
            .enter() //create an element for each datum
            .append("path") //append each element to the svg as a path element
            .attr("class", "gratLines") //assign class for styling
            .attr("d", path); //project graticule lines

        var csvData = data[0],
            usaTopo = data[1],
            countyTopo = data[2],
            ilTopo = data[3];
        
        //translate illinois TopoJSON
        var usaTrans = topojson.feature(usaTopo, usaTopo.objects.cb_2018_us_state_20m),
            countyTrans = topojson.feature(countyTopo, countyTopo.objects.il_counties_wgs84),
            chiCounties = topojson.feature(ilTopo, ilTopo.objects.chicagoland_counties_wgs84).features;

        //add US states to map
        var states = map.append("path")
            .datum(usaTrans)
            .attr("class", "states")
            .attr("d", path);

        //add IL counties to map
        var counties = map.append("path")
            .datum(countyTrans)
            .attr("class", "counties")
            .attr("d", path);

        // join csv data to IL counties GeoJSON
        chiCounties = joinData(chiCounties, csvData);

        //create the color scale
        var colorScale = makeColorScale(csvData);

        //add enumeration units to the map
        setEnumerationUnits(chiCounties, map, path, colorScale);

        //add coordinated visualization to the map
        setChart(csvData, colorScale);
        
        //create dropdown menu
        createDropdown(csvData);
    };
}; //end of setMap()

//function to create color scale generator
function makeColorScale(data){
    var colorClasses = [
        "#ffffcc",
        "#a1dab4",
        "#41b6c4",
        "#2c7fb8",
        "#253494"
    ];

    //create color scale generator
    var colorScale = d3.scaleQuantile()
        .range(colorClasses);

    //build array of all values of the expressed attribute
    var domainArray = [];
    for (var i=0; i<data.length; i++){
        var val = parseFloat(data[i][expressed]);
        domainArray.push(val);
    };

    //assign array of expressed values as scale domain
    colorScale.domain(domainArray);

    // console.log(colorScale.quantiles());
    return colorScale;
};

function joinData(chiCounties, csvData){
    //loop through csv to assign each set of csv attribute values to geojson region
    for (var i=0; i<csvData.length; i++){
        var csvTract = csvData[i]; //the current region
        var csvKey = csvTract.GEOID10; //the CSV primary key

        //loop through geojson county to find correct county
        for (var a=0; a<chiCounties.length; a++){

            var geojsonProps = chiCounties[a].properties; //the current region geojson properties
            var geojsonKey = geojsonProps.GEOID10; //the geojson primary key

            //where primary keys match, transfer csv data to geojson properties object
            if (geojsonKey == csvKey){

                //assign all attributes and values
                attrArray.forEach(function(attr){
                    var val = parseFloat(csvTract[attr]); //get csv attribute value
                    geojsonProps[attr] = val; //assign attribute and value to geojson properties
                });
            // console.log(geojsonProps)
            };
        };
    };

    return chiCounties;
}

function setEnumerationUnits(chiCounties, map, path, colorScale){
    //add Chicagoland counties to map
    var counties = map.selectAll('.chiCounties')
    .data(chiCounties)
    .enter()
    .append('path')
    .attr('class', function(d){
        return 'chiCounties ' + d.properties.GEOID10;
    })
    .attr('d', path)
    .style("fill", function(d){            
        var value = d.properties[expressed];            
        if(value) {                
            return colorScale(value);            
        } else {                
            return "#ccc";            
        }       
     })
    .on("mouseover", function(event, d){
        highlight(d.properties);
    })
    .on("mouseout", function(event, d){
        dehighlight(d.properties);
    })
    .on("mousemove", moveLabel);
    //add style descriptor to each path
    var desc = counties.append("desc")
    .text('{"stroke": "#000", "stroke-width": "0.5px"}');

};

//function to create coordinated bar chart
function setChart(csvData, colorScale){

    //create a second svg element to hold the bar chart
    var chart = d3.select("body")
        .append("svg")
        .attr("width", chartWidth)
        .attr("height", chartHeight)
        .attr("class", "chart");

    //create a rectangle for chart background fill
    var chartBackground = chart.append("rect")
        .attr("class", "chartBackground")
        .attr("width", chartInnerWidth)
        .attr("height", chartInnerHeight)
        .attr("transform", translate);

    //set bars for each province
    var bars = chart.selectAll(".bar")
        .data(csvData)
        .enter()
        .append("rect")
        .sort(function(a, b){
            return b[expressed]-a[expressed]
        })
        .attr("class", function(d){
            return "bar " + d.GEOID10;
        })
        .attr("width", chartInnerWidth / csvData.length - 1)
        .on("mouseover", function(event, d){
            highlight(d);
        })
        .on("mouseout", function(event, d){
            dehighlight(d);
        })
        .on("mousemove", moveLabel);

    //add style descriptor to each rect
    var desc = bars.append("desc")
    .text('{"stroke": "none", "stroke-width": "0px"}');

    //create a text element for the chart title
    var chartTitle = chart.append("text")
        .attr("x", 40)
        .attr("y", 40)
        .attr("class", "chartTitle")
        .text("Med. Household Inc., Chicago Area, " + attrArray[6].slice(-4));

    //create vertical axis generator
    var yAxis = d3.axisLeft()
        .scale(yScale);

    //place axis
    var axis = chart.append("g")
        .attr("class", "axis")
        .attr("transform", translate)
        .call(yAxis);

    //create frame for chart border
    var chartFrame = chart.append("rect")
        .attr("class", "chartFrame")
        .attr("width", chartInnerWidth)
        .attr("height", chartInnerHeight)
        .attr("transform", translate);

    //set bar positions, heights, and colors
    updateChart(bars, csvData.length, colorScale);
}; //end of setChart()

//function to create a dropdown menu for attribute selection
function createDropdown(csvData){
    //add select element
    var dropdown = d3.select("body")
        .append("select")
        .attr("class", "dropdown")
        .on("change", function(){
            changeAttribute(this.value, csvData)
        });

    //add initial option
    var titleOption = dropdown.append("option")
        .attr("class", "titleOption")
        .attr("disabled", "true")
        .text("Select Attribute");

    //add attribute name options
    var attrOptions = dropdown.selectAll("attrOptions")
        .data(attrArray)
        .enter()
        .append("option")
        .attr("value", function(d){ return d })
        .text(function(d){ return d });
    };

//dropdown change event handler
function changeAttribute(attribute, csvData) {
    //change the expressed attribute
    expressed = attribute;

    //recreate the color scale
    var colorScale = makeColorScale(csvData);

    console.log("Expressed attribute:", expressed); // Log the expressed attribute
    
    console.log("Color Scale Quantiles:", colorScale.quantiles());  //Log color scale


    //recolor enumeration units
    var counties = d3.selectAll(".chiCounties")
        .transition()
        .duration(1000)
        .style("fill", function(d){            
            var value = d.properties[expressed];            
            if(value) {                
                return colorScale(value);           
            } else {                
                return "#ccc";            
            }    
    });

    //Sort, resize, and recolor bars
    var bars = d3.selectAll(".bar")
    //Sort bars
    .sort(function(a, b){
        return b[expressed] - a[expressed];
    })
    .transition() //add animation
    .delay(function(d, i){
        return i * 20
    })
    .duration(500)

    updateChart(bars, csvData.length, colorScale);
}; //end of changeAttribute()

//function to position, size, and color bars in chart
function updateChart(bars, n, colorScale){
    //position bars
    bars.attr("x", function(d, i){
            return i * (chartInnerWidth / n) + leftPadding;
        })
        //size/resize bars
        .attr("height", function(d, i){
            return 463 - yScale(parseFloat(d[expressed]));
        })
        .attr("y", function(d, i){
            return yScale(parseFloat(d[expressed])) + topBottomPadding;
        })
        //color/recolor bars
        .style("fill", function(d){            
            var value = d[expressed];            
            if(value) {                
                return colorScale(value);            
            } else {                
                return "#ccc";            
            }    
    });
    //add text to chart title
    var chartTitle = d3.select(".chartTitle")
    .text("Med. Household Inc., Chicago Area, " + attrArray[6].slice(-4));
};

//function to highlight enumeration units and bars
function highlight(props){
    //change stroke
    var selected = d3.selectAll("." + props.GEOID10)
        .style("stroke", "blue")
        .style("stroke-width", "2")
    setLabel(props)
};

//function to reset the element style on mouseout
function dehighlight(props){
    var selected = d3.selectAll("." + props.GEOID10)
        .style("stroke", function(){
            return getStyle(this, "stroke")
        })
        .style("stroke-width", function(){
            return getStyle(this, "stroke-width")
        })
        //remove info label
        d3.select(".infolabel")
        .remove();

    function getStyle(element, styleName){
        var styleText = d3.select(element)
            .select("desc")
            .text();

        var styleObject = JSON.parse(styleText);

        return styleObject[styleName];
    };
};

//function to create dynamic label
function setLabel(props){
    //label content
    var labelAttribute = "<h1>" + "$" + props[expressed] +
        "</h1><b>" + expressed + "</b>";

    //create info label div
    var infolabel = d3.select("body")
        .append("div")
        .attr("class", "infolabel")
        .attr("id", props.GEOID10 + "_label")
        .html(labelAttribute);

    var regionName = infolabel.append("div")
        .attr("class", "labelname")
        .html("ID: " + props.GEOID10);
};

//function to move info label with mouse
function moveLabel(){
    //get width of label
    var labelWidth = d3.select(".infolabel")
        .node()
        .getBoundingClientRect()
        .width;

    //use coordinates of mousemove event to set label coordinates
    var x1 = event.clientX + 10,
        y1 = event.clientY - 75,
        x2 = event.clientX - labelWidth - 10,
        y2 = event.clientY + 25;

    //horizontal label coordinate, testing for overflow
    var x = event.clientX > window.innerWidth - labelWidth - 20 ? x2 : x1; 
    //vertical label coordinate, testing for overflow
    var y = event.clientY < 75 ? y2 : y1; 

    d3.select(".infolabel")
        .style("left", x + "px")
        .style("top", y + "px");
};



})();
