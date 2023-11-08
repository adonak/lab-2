//begin script when window loads
window.onload = setMap();

//set up choropleth map
function setMap(){

    //map frame dimensions
    var width = 960,
        height = 460;

    //create new svg container for the map
    var map = d3.select('body')
        .append('svg')
        .attr('class', 'map')
        .attr('width', width)
        .attr('height', height);

    //create Albers equal area conic projection centered on France
    var projection = d3.geoAlbers()
        .center([4, 40])
        .rotate([94, 0, 0])
        .parallels([45, 90])
        .scale(4500)
        .translate([width / 2, height / 2]);

    var path = d3.geoPath()
        .projection(projection);

    //use Promise.all to parallelize asynchronous data loading
    var promises = [];    
    promises.push(d3.csv('data/marketCharacteristics_table.csv')); //load attributes from csv    
    promises.push(d3.json('data/il_tracts_2020_wgs84.topojson')); //load choropleth spatial data    
    Promise.all(promises).then(callback);

    function callback(data) {
        var csvData = data[0],
            illinois = data[1];
        
        //translate illinois TopoJSON
        var illinoisTracts = topojson.feature(illinois, illinois.objects.il_tracts_2020_wgs84).features;

        //add Illinois tracts to map
        var tracts = map.selectAll('.tracts')
            .data(illinoisTracts)
            .enter()
            .append('path')
            .attr('class', function(d){
                return 'tracts ' + d.properties.GEOID;
            })
            .attr('d', path);
    }
};
