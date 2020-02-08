Error.stackTraceLimit = Infinity;

const fs = require("fs");
const args = require("args");
const unirest = require("unirest");
const timestamp = require('time-stamp');
const path = require('path');

args.option('config', "path to config file to load (JSON form) see README.md for example", "config.json")
	.option('apikey', "API key used for OpenWeatherMap calls. Superceeds config file apikey (if specified)")
	.option('port', "port number to listen on. Superceeds config file apikey (if specified)")
	.option('refreshrate', "refresh rate (in seconds) for OpenWeatherMap api calls. Superceeds config file apikey (if specified)")
	.option('units', "units for OpenWeatherMap api calls. Superceeds config file apikey (if specified)")
    .option('debug', "Print debug messages", false)

const flags = args.parse(process.argv);

let productName = "jrcichra/opcua-weather";
let buildNumber = "10";
let buildDate = Date(2020, 2, 8);

console.log(ts(),productName,`build`,buildNumber);

let config = flags.config;
let apikey;
let refreshrate;
let coordinates = [];
let cities = [];
let units;
let port;
let debug;

parseConfig(config);

function parseConfig(config) {
    // let filePath = path.join(path.dirname(process.execPath), config);
    if (fs.existsSync(config)) {
        // File exists, check if json
        try {
            config = JSON.parse(fs.readFileSync(config));
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
		//Parse out the refreshrate (required)
        try {
            refreshrate = config.refreshrate;
        } catch (e) {
            throw new Error(e);
        }
		//Parse out the units (required)
        try {
            units = config.units;
        } catch (e) {
            throw new Error(e);
        }
        //Parse out the port (optional)
        try {
            port = config.port;
		} catch (e) {
            throw new Error(e);
        }
		//Parse out debugging (optional)
        try {
            debug = config.debug;
		} catch (e) {
            throw new Error(e);
        }
        //Parse out coordinates (optional)
        try {
            for (c = 0; c < config.coordinates.length; c++) {
				//console.log(c, config.coordinates[c])
                if ("name" in config.coordinates[c] && "lat" in config.coordinates[c] && "lon" in config.coordinates[c]) {
					console.log(ts(), `Loading location from config for:`,config.coordinates[c].name)
                    coordinates.push(config.coordinates[c]);
                } else {
                    throw new Error("Missing/Bad location(s) in configuration file - expecting name+lat+lon for each coordinate");
                }
            }
            
        } catch (e) {
            //console out something was wrong, but don't error
            console.log(timestamp('YYYY-MM-DD HH:mm:ss'), e);
        }
        
        //Parse out units (optional)
        if ("units" in config) {
            units = config.units;
        }

    }

    //overwrite with command line stuff if it's there
    if (flags.apikey) {
		console.log(ts(), `Using API key of`,flags.apikey,`specified in command.`);
        apikey = flags.apikey;
    }
	if (flags.port) {
		console.log(ts(), `Using port of`,flags.port,`specified in command.`);
        port = flags.port;
    }
	if (flags.refreshrate) {
		console.log(ts(), `Using Refresh Rate of`,flags.refreshrate,`specified in command.`);
        refreshrate = flags.refreshrate;
    }
    if (flags.units) {
		console.log(ts(), `Using Units of`,flags.units,`specified in command.`);
        units = flags.units;
    }
    if (flags.debug) {
		console.log(ts(), `Using debug of`,flags.debug,`specified in command.`);
        debug = flags.debug;
    }

}


async function getCoordinateWeather(coordinate) {

    const result = await new Promise((resolve) => {
		if (flags.debug) {
		console.log(ts(),`Requesting:`,
            `http://api.OpenWeatherMap.org/data/2.5/weather?units=${units}`
            + "&mode=json"
            + `&lat=${coordinate.lat}`
            + `&lon=${coordinate.lon}`
            + `&appid=${apikey}`);
		}
        unirest.get(
            `http://api.OpenWeatherMap.org/data/2.5/weather?units=${units}`
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
     //console.log(`For coords:${JSON.stringify(result.body)}`)
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

function extractUsefulData(data,loc) {
    return {
		loc: loc,
        date: new Date(),
        observation_time: unixEpoqToDate(data.dt),
        temperature: data.main.temp,
        humidity: data.main.humidity,
        pressure: data.main.pressure,
        weather: data.weather[0].main,
		weathericon: data.weather[0].icon
    };
}

function setUsefulData(loc) {
    return {
		loc: loc,
    };
}

let data_map = {};

async function update_coordinate_data(coordinate) {

    try {
        const data = await getCoordinateWeather(coordinate);
		//console.log(ts(),`coord data `, data);
        data_map[coordinate.name] = extractUsefulData(data,coordinate.name);
		//console.log(ts(),`data map coord`, data_map[coordinate.name]);
    }
    catch (e) {
        console.log(ts(), "error coordinate", coordinate, e);
        return;
    }
}

// make a API call for each coordinate on its desired interval
//for (c = 0; c < coordinates.length; c++) {
    setInterval(async () => {
		console.log(ts(), `Updating weather data from OpenWeatherMap API`);
		for (c = 0; c < coordinates.length; c++) {
			//console.log(ts(), c);
        if (flags.debug) {
            console.log(ts(), `Updating coordinate: ${coordinates[c].name},${coordinates[c].lat},${coordinates[c].lon}`);
        }
        await update_coordinate_data(coordinates[c]);}
    }, refreshrate * 1000);


const opcua = require("node-opcua");

function construct_my_address_space(server) {
    // declare some folders
    const addressSpace = server.engine.addressSpace;
    const namespace = addressSpace.getOwnNamespace();
    const objectsFolder = addressSpace.rootFolder.objects;

    const citiesNode = namespace.addFolder(objectsFolder, { browseName: "Locations" });

    for (let coord of coordinates) {
        // declare the coord node
        const coordNode = namespace.addFolder(citiesNode, { browseName: coord.name });
        namespace.addVariable({
            componentOf: coordNode,
            browseName: "Temperature",
            nodeId: `s=${coord.name}-Temperature`,
            dataType: "Double",
            value: { get: function () { return extract_value(opcua.DataType.Double, coord.name, "temperature"); } }
        });
        namespace.addVariable({
            componentOf: coordNode,
            nodeId: `s=${coord.name}-Humidity`,
            browseName: "Humidity",
            dataType: "Double",
            value: { get: function () { return extract_value(opcua.DataType.Double, coord.name, "humidity"); } }
        });
        namespace.addVariable({
            componentOf: coordNode,
            nodeId: `s=${coord.name}-Pressure`,
            browseName: "Pressure",
            dataType: "Double",
            value: { get: function () { return extract_value(opcua.DataType.Double, coord.name, "pressure"); } }
        });
        namespace.addVariable({
            componentOf: coordNode,
            nodeId: `s=${coord.name}-Weather`,
            browseName: "Weather",
            dataType: "String",
            value: { get: function () { return extract_value(opcua.DataType.String, coord.name, "weather"); } }
        });
		 namespace.addVariable({
            componentOf: coordNode,
            nodeId: `s=${coord.name}-WeatherIcon`,
            browseName: "WeatherIcon",
            dataType: "String",
            value: { get: function () { return extract_value(opcua.DataType.String, coord.name, "weathericon"); } }
        });
    }
}
function extract_value(dataType, loc_name, property) {
    const locNm = data_map[loc_name];
	//console.log(ts(), `Loc Name check for: `, loc_name, property, locNm);
    if (!locNm) {
		//console.log(ts(), `Loc Bad: `, loc_name);
        return opcua.StatusCodes.BadDataUnavailable
    }

    const value = locNm[property];
    return new opcua.Variant({ dataType, value: value });
}

(async () => {

    try {

        const server = new opcua.OPCUAServer({
            port: port,
            buildInfo: {
                productName: productName,
                buildNumber: buildNumber,
                buildDate: buildDate,
            },
            certificateFile: "./certificates/client_selfsigned_cert_2048.pem",
            privateKeyFile: "./certificates/client_key_2048.pem"
        });


        await server.initialize();

        construct_my_address_space(server);

        await server.start();

        console.log(ts(), `OPC DA server is listening on port ${server.endpoints[0].port}... (press CTRL+C to stop)`);
        const endpointUrl = server.endpoints[0].endpointDescriptions()[0].endpointUrl;
        console.log(ts(), `The primary server endpoint url is ${endpointUrl}`);
    }
    catch (e) {
        console.log(ts(), `Error: ${e}`);
    }
})();