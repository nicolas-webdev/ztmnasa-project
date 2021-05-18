const launchesDatabase = require("./launches.mongo");
const planets = require("./planets.mongo");

const DEFAULT_FLIGHT_NUMBER = 100;

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

async function getAllLaunches() {
  return await launchesDatabase.find({}, { _id: 0, __v: 0 });
}

async function saveLaunch(launch) {
  try {
    const planet = await planets.findOne({
      keplerName: launch.target,
    });
    if (!planet) {
      throw new Error("No matching planet found.");
    }
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
  const newFlightNumber = Number(await getLatestFlightNumber()) + 1;
  const newLaunch = Object.assign(launch, {
    customers: ["Zero to Mastery", "NASA"],
    flightNumber: newFlightNumber,
    success: true,
    upcoming: true,
  });

  return await saveLaunch(newLaunch);
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
  getAllLaunches,
  scheduleNewLaunch,
  abortLaunchById,
};

// const launch = {
//   flightNumber: 100,
//   mission: "Kepler Exploration X",
//   rocket: "Explorer IS1",
//   launchDate: new Date("December 27, 2030"),
//   target: "Kepler-442 b",
//   customers: ["ZTM", "NASA"],
//   upcoming: true,
//   success: true,
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
