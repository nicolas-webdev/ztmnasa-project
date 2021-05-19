const axios = require("axios");

const launchesDatabase = require("./launches.mongo");
const planets = require("./planets.mongo");

const DEFAULT_FLIGHT_NUMBER = 100;

const SPACEX_API_URL = "https://api.spacexdata.com/v4/launches/query";

async function existsLaunchWithId(launchId) {
  return await launchesDatabase.findOne({
    flightNumber: launchId,
  });
}

async function getLatestFlightNumber() {
  try {
    const latestLaunch = await launchesDatabase
      .findOne({})
      .sort("-flightNumber");

    if (!latestLaunch) {
      return DEFAULT_FLIGHT_NUMBER;
    }

    return latestLaunch.flightNumber;
  } catch (err) {
    console.error(err);
  }
}

async function findLaunch(filter) {
  return await launchesDatabase.findOne(filter);
}

async function populateLaunches() {
  console.log("Downloading launch data...");
  const response = await axios.post(SPACEX_API_URL, {
    query: {},
    options: {
      // page: 1,
      pagination: false,
      populate: [
        {
          path: "rocket",
          select: {
            name: 1,
          },
        },
        {
          path: "payloads",
          select: {
            customers: 1,
          },
        },
      ],
    },
  });

  if (response.status !== 200) {
    console.log("Problem downloading launch data: " + response.status);
    throw new Error("Launch data download failed " + response.status);
  }

  const launchDocs = response.data.docs;
  for (const launchDoc of launchDocs) {
    const payloads = launchDoc["payloads"];
    const customers = payloads.flatMap((payload) => payload["customers"]);

    const launch = {
      flightNumber: launchDoc["flight_number"],
      mission: launchDoc["name"],
      rocket: launchDoc["rocket"]["name"],
      launchDate: launchDoc["date_local"],
      // target: "N/A",
      upcoming: launchDoc["upcoming"],
      success: launchDoc["success"],
      customers, //payload.customers
    };

    console.log(`${launch.flightNumber} ${launch.mission}`);

    //populate launches collection
    await saveLaunch(launch);
  }
}

async function loadLaunchData() {
  const firstLaunch = await findLaunch({
    flightNumber: 1,
    rocket: "Falcon 1",
    mission: "FalconSat",
  });

  if (firstLaunch) {
    console.log("Launch data already loaded!");
  } else {
    await populateLaunches();
  }
}

async function getAllLaunches(skip, limit) {
  return await launchesDatabase
    .find({}, { _id: 0, __v: 0 })
    .sort({ flightNumber: 1 })
    .skip(skip)
    .limit(limit);
}

async function saveLaunch(launch) {
  try {
    await launchesDatabase.findOneAndUpdate(
      {
        flightNumber: launch.flightNumber,
      },
      launch,
      { upsert: true }
    );
    return true;
  } catch (err) {
    console.log(err);
    return false;
  }
}

async function scheduleNewLaunch(launch) {
  try {
    const planet = await planets.findOne({
      keplerName: launch.target,
    });
    if (!planet) {
      throw new Error("No matching planet found.");
    }
    const newFlightNumber = Number(await getLatestFlightNumber()) + 1;
    const newLaunch = Object.assign(launch, {
      customers: ["Zero to Mastery", "NASA"],
      flightNumber: newFlightNumber,
      success: true,
      upcoming: true,
    });
    return await saveLaunch(newLaunch);
  } catch (err) {
    console.log("An error ocurred scheduling launch");
  }
}

async function abortLaunchById(launchId) {
  try {
    const aborted = await launchesDatabase.updateOne(
      {
        flightNumber: launchId,
      },
      {
        upcoming: false,
        success: false,
      }
    );

    return aborted.ok === 1 && aborted.nModified === 1;
  } catch (err) {
    console.error("Error aborting launch: " + err);
    return false;
  }
}

module.exports = {
  existsLaunchWithId,
  loadLaunchData,
  getAllLaunches,
  scheduleNewLaunch,
  abortLaunchById,
};

// const launch = {
//   flightNumber: 100, //flight_number
//   mission: "Kepler Exploration X", //name
//   rocket: "Explorer IS1", //rocket.name
//   launchDate: new Date("December 27, 2030"), //date_local
//   target: "Kepler-442 b", //na
//   customers: ["ZTM", "NASA"], //payload.customers
//   upcoming: true, //same
//   success: true, //same
// };

// const launches = new Map();
// let latestFlightNumber = 100;

// saveLaunch(launch);
// launches.set(launch.flightNumber, launch);

// function addNewLaunch(launch) {
//   latestFlightNumber++;
//   launches.set(
//     latestFlightNumber,
//     Object.assign(launch, {
//       customers: ["Zero to Mastery", "NASA"],
//       flightNumber: latestFlightNumber,
//       success: true,
//       upcoming: true,
//     })
//   );
// }
