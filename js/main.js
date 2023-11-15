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

    //create Albers equal area conic projection centered on Illinois
    var projection = d3.geoAlbers()
        .center([5.75, 41.75])
        .rotate([94, 0, 0])
        .parallels([45, 90])
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
            ilTrans = topojson.feature(ilTopo, ilTopo.objects.chicagoland_counties_wgs84).features;

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
        ilJoin = joinData(ilTrans, csvData);

        //create the color scale
        var colorScale = makeColorScale(csvData);

        //add enumeration units to the map
        setEnumerationUnits(ilJoin, map, path, colorScale);

        //add coordinated visualization to the map
        setChart(csvData, colorScale);
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

function joinData(ilTrans, csvData){
    //loop through csv to assign each set of csv attribute values to geojson region
    for (var i=0; i<csvData.length; i++){
        var csvTract = csvData[i]; //the current region
        var csvKey = csvTract.GEOID; //the CSV primary key

        //loop through geojson regions to find correct region
        for (var a=0; a<ilTrans.length; a++){

            var geojsonProps = ilTrans[a].properties; //the current region geojson properties
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

    return ilTrans;
}

function setEnumerationUnits(ilTrans, map, path, colorScale){
    //add Chicagoland counties to map
    var chiCounties = map.selectAll('.chiCounties')
    .data(ilTrans)
    .enter()
    .append('path')
    .attr('class', function(d){
        return 'chiCounties ' + d.properties.GEOID;
    })
    .attr('d', path)
    .style('fill', function(d){
        return colorScale(d.properties[expressed]);
    })
};

//function to create coordinated bar chart
function setChart(csvData, colorScale){
    //chart frame dimensions
    var chartWidth = window.innerWidth * 0.425,
        chartHeight = 460;

    //create a second svg element to hold the bar chart
    var chart = d3.select("body")
        .append("svg")
        .attr("width", chartWidth)
        .attr("height", chartHeight)
        .attr("class", "chart");
        
    //create a scale to size bars proportionally to frame
    var yScale = d3.scaleLinear()
        .range([0, chartHeight])
        .domain([0, 150000]);

    //set bars for each county
    var bars = chart.selectAll(".bars")
        .data(csvData)
        .enter()
        .append("rect")
        .sort(function(a, b){
            return a[expressed]-b[expressed]
        })
        .attr("class", function(d){
            return "bars " + d.GEOID;
        })
        .attr("width", chartWidth / csvData.length - 1)
        .attr("x", function(d, i){
            return i * (chartWidth / csvData.length);
        })
        .attr("height", function(d){
            return yScale(parseFloat(d[expressed]));
        })
        .attr("y", function(d){
            return chartHeight - yScale(parseFloat(d[expressed]));
        })
        .style("fill", function(d){
            return colorScale(d[expressed]);
        });

    //annotate bars with attribute value text
    var numbers = chart.selectAll(".numbers")
    .data(csvData)
    .enter()
    .append("text")
    .sort(function(a, b){
        return a[expressed]-b[expressed]
    })
    .attr("class", function(d){
        return "numbers " + d.GEOID;
    })
    .attr("text-anchor", "middle")
    .attr("x", function(d, i){
        var fraction = chartWidth / csvData.length;
        return i * fraction + (fraction - 1) / 2;
    })
    .attr("y", function(d){
        return chartHeight - yScale(parseFloat(d[expressed])) + 15;
    })
    .text(function(d){
        return "$" + d[expressed];
    });

    //create a text element for the chart title
    var chartTitle = chart.append("text")
        .attr("x", 20)
        .attr("y", 40)
        .attr("class", "chartTitle")
        .text("Med. Household Inc., Chicagoland Counties, " + attrArray[6].slice(-4));
};


})();
