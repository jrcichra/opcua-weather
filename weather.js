Error.stackTraceLimit = Infinity;

const fs = require("fs");
const args = require("args");
const unirest = require("unirest");
const timestamp = require('time-stamp');

args.option('config', "path to config file to load (JSON form) see README.md for example", "config.json")
    .option('apikey', "API key used for openweathermap calls. Superceeds config file apikey (if specified)")
    .option('units', " globally set units requested from openweathermap", "imperial")
    .option('port', " port number to listen on", 4334)
    .option('debug', "Print debug messages", false)
const flags = args.parse(process.argv);

let config = flags.config;
let apikey;
let coordinates = [];
let cities = [];
let units;
let port;

parseConfig(config);

function parseConfig(config) {
    if (fs.existsSync(config)) {
        // File exists, check if json
        try {
            config = JSON.parse(fs.readFileSync(flags.config));
        }
        // Error if there's an issue
        catch (e) {
            throw new Error(e);
        }
        //Parse out the key (required)
        try {
            apikey = config.apikey;
        } catch (e) {
            throw new Error(e);
        }
        //Parse out the port (optional)
        if ("port" in config) {
            port = config.port;
        }
        //Parse out coordinates (optional)
        try {
            //Make sure all the keys are there
            for (c of config.coordinates) {
                if ("name" in c && "lat" in c && "lon" in c && "interval" in c) {
                    coordinates.push(c);
                } else {
                    throw new Error("Missing key in configuration file - expecting name+lat+lon+interval for each coordinate");
                }
            }
            // //Make c an array
            // coords = coords.split(';');
            // //loop through each c
            // for (c of coords) {
            //     let latlon = c.split(',');
            //     let lat = latlon[0];
            //     let lon = latlon[1];
            //     coordinates.push({ lat: lat, lon: lon });
            // }

        } catch (e) {
            //console out something was wrong, but don't error
            console.log(timestamp('YYYY-MM-DD HH:mm:ss'), e);
        }
        //Parse out cities (optional)
        try {
            //Make sure all the keys are there
            for (c of config.cities) {
                if ("name" in c && "interval" in c) {
                    cities.push(c);
                } else {
                    throw new Error("Missing key in configuration file - expecting name+interval for each city");
                }
            }
        } catch (e) {
            //console out something was wrong, but don't error
            console.log(ts(), e);
        }
        //Parse out units (optional)
        if ("units" in config) {
            units = config.units;
        }

    }

    //overwrite with command line stuff if it's there
    if (flags.apikey) {
        apikey = flags.apikey;
    }
    if (flags.units) {
        units = flags.units;
    }
    if (flags.port) {
        port = flag.port;
    }
}

async function getCityWeather(city) {

    const result = await new Promise((resolve) => {
        unirest.get(
            `http://api.openweathermap.org/data/2.5/weather?units=${units}`
            + "&mode=json"
            + `&q=${city}`
            + `&appid=${apikey}`)
            .end(
                (response) => resolve(response)
            );
    });
    if (result.status !== 200) {
        throw new Error(`API error ${result.status}`);
    }
    return result.body;
}
async function getCoordinateWeather(coordinate) {

    const result = await new Promise((resolve) => {
        unirest.get(
            `http://api.openweathermap.org/data/2.5/weather?units=${units}`
            + "&mode=json"
            + `&lat=${coordinate.lat}`
            + `&lon=${coordinate.lon}`
            + `&appid=${apikey}`)
            .end(
                (response) => resolve(response)
            );
    });
    if (result.status !== 200) {
        throw new Error(`API error ${result.status}`);
    }
    return result.body;
}

function ts() {
    return timestamp('YYYY-MM-DD HH:mm:ss:').toString();
}

function unixEpoqToDate(unixDate) {
    const d = new Date(0);
    d.setUTCSeconds(unixDate);
    return d;
}

function extractUsefulData(data) {
    return {
        city: data.city,
        date: new Date(),
        observation_time: unixEpoqToDate(data.dt),
        temperature: data.main.temp,
        humidity: data.main.humidity,
        pressure: data.main.pressure,
        weather: data.weather[0].main
    };
}

const data_map = {};

async function update_city_data(city) {

    try {
        const data = await getCityWeather(city);
        data_map[city] = extractUsefulData(data);
    }
    catch (e) {
        console.log(ts(), "error city", city, e);
        return;
    }
}

async function update_coordinate_data(coordinate) {

    try {
        const data = await getCoordinateWeather(coordinate);
        data_map[coordinate] = extractUsefulData(data);
    }
    catch (e) {
        console.log(ts(), "error coordinate", coordinate, e);
        return;
    }
}

// make a API call for each city on its desired interval
for (c of cities) {
    let city = c.name;
    setInterval(async () => {
        if (flags.debug) {
            console.log(ts(), `Updating city: ${city}`);
        }
        await update_city_data(city);
    }, c.interval * 1000);
}

// make a API call for each coordinate on its desired interval
for (c of coordinates) {
    setInterval(async () => {
        if (flags.debug) {
            console.log(ts(), `Updating coordinate: ${c.lat},${c.lon}`);
        }
        await update_coordinate_data(c);
    }, c.interval * 1000);
}


const opcua = require("node-opcua");


function construct_my_address_space(server) {
    // declare some folders
    const addressSpace = server.engine.addressSpace;
    const namespace = addressSpace.getOwnNamespace();
    const objectsFolder = addressSpace.rootFolder.objects;

    const citiesNode = namespace.addFolder(objectsFolder, { browseName: "Cities" });

    for (let city_name of cities) {
        // declare the city node
        const cityNode = namespace.addFolder(citiesNode, { browseName: city_name });
        namespace.addVariable({
            componentOf: cityNode,
            browseName: "Temperature",
            nodeId: `s=${city_name}-Temperature`,
            dataType: "Double",
            value: { get: function () { return extract_value(opcua.DataType.Double, city_name, "temperature"); } }
        });
        namespace.addVariable({
            componentOf: cityNode,
            nodeId: `s=${city_name}-Humidity`,
            browseName: "Humidity",
            dataType: "Double",
            value: { get: function () { return extract_value(opcua.DataType.Double, city_name, "humidity"); } }
        });
        namespace.addVariable({
            componentOf: cityNode,
            nodeId: `s=${city_name}-Pressure`,
            browseName: "Pressure",
            dataType: "Double",
            value: { get: function () { return extract_value(opcua.DataType.Double, city_name, "pressure"); } }
        });
        namespace.addVariable({
            componentOf: cityNode,
            nodeId: `s=${city_name}-Weather`,
            browseName: "Weather",
            dataType: "String",
            value: { get: function () { return extract_value(opcua.DataType.String, city_name, "weather"); } }
        });
    }
}
function extract_value(dataType, city_name, property) {
    const city = data_map[city_name];
    if (!city) {
        return opcua.StatusCodes.BadDataUnavailable
    }

    const value = city[property];
    return new opcua.Variant({ dataType, value: value });
}

(async () => {

    try {

        const server = new opcua.OPCUAServer({
            port: port,
            buildInfo: {
                productName: "OpenWeatherStation",
                buildNumber: "7658",
                buildDate: new Date(2020, 2, 6),
            }
        });


        await server.initialize();

        construct_my_address_space(server);

        await server.start();

        console.log(ts(), `opcua-weather is listening on port ${server.endpoints[0].port}... (press CTRL+C to stop)`);
        const endpointUrl = server.endpoints[0].endpointDescriptions()[0].endpointUrl;
        console.log(ts(), `The primary server endpoint url is ${endpointUrl}`);

    }
    catch (e) {
        console.log(ts(), `Error: ${e}`);
    }
})();