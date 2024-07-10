import { myAgent } from "./index.js";
import { client } from "./config.js";
import { CollaboratorData, MyData } from "./communication/coordination.js";
export { computeBestOption, calculate_pickup_utility, calculate_putdown_utility, distanceBFS_notMe, findPath_BFS, find_nearest_delivery, map, find_random_deliveryFarFromOther, deliveryCoordinates, distanceBFS, beliefset }


// Function to update the configuration of elements
//!CONFIGURATION
// Config received:  {
//     MAP_FILE: 'map_20',
//     PARCELS_GENERATION_INTERVAL: '5s',
//     PARCELS_MAX: '5',
//     MOVEMENT_STEPS: 1,
//     MOVEMENT_DURATION: 500,
//     AGENTS_OBSERVATION_DISTANCE: 5,
//     PARCELS_OBSERVATION_DISTANCE:. 5,
//     AGENT_TIMEOUT: 10000,
//     PARCEL_REWARD_AVG: 50,
//     PARCEL_REWARD_VARIANCE: 10,
//     PARCEL_DECADING_INTERVAL: 'infinite',
//     RANDOMLY_MOVING_AGENTS: 2,
//     RANDOM_AGENT_SPEED: '2s',
//     CLOCK: 50
//   }

var decade_frequency = 0;
var configElements;
client.onConfig((config) => {
    configElements = config;

    let movement_duration = configElements.MOVEMENT_DURATION;
    let parcel_decading_interval = configElements.PARCEL_DECADING_INTERVAL;

    if (parcel_decading_interval == "infinite") {
        parcel_decading_interval = Number.MAX_VALUE;
    } else {
        parcel_decading_interval = parseInt(parcel_decading_interval.slice(0, -1)) * 1000;
    }

    decade_frequency = movement_duration / parcel_decading_interval;
});


function findBestOption(options, id = "undefined") {
    let bestUtility = -1.0;
    let best_option = [];
    for (const option of options) {
        let current_utility = option[4];
        if (current_utility > bestUtility) {
            if (option[3] != id) {
                best_option = option
                bestUtility = current_utility
            }
        }
    }
    return best_option;
}

function computeBestOption() {

    for (let s_elem of CollaboratorData.options) {
        let found = false;
        for (let m_elem of MyData.options) {
            if (s_elem[3] == m_elem[3] && s_elem[0] == "go_pick_up" && m_elem[0] == "go_pick_up") {
                found = true;
            }
        }
        if (!found && s_elem[0] == "go_pick_up") {
            let parcel = CollaboratorData.getParcelById(s_elem[3]);
            MyData.options.push(['go_pick_up', parcel.x, parcel.y, parcel.id, calculate_pickup_utility(parcel)]);
        }
    }
    for (let m_elem of MyData.options) {
        let found = false;
        for (let s_elem of CollaboratorData.options) {
            if (s_elem[3] == m_elem[3] && s_elem[0] == "go_pick_up" && m_elem[0] == "go_pick_up") {
                found = true;
            }
        }
        if (!found && m_elem[0] == "go_pick_up") {
            let parcel = MyData.getParcelById(m_elem[3])
            CollaboratorData.options.push(['go_pick_up', parcel.x, parcel.y, parcel.id, calculate_pickup_utility(parcel, CollaboratorData.pos)]);
        }
    }

    MyData.best_option = findBestOption(MyData.options)

    CollaboratorData.best_option = findBestOption(CollaboratorData.options)

    if (MyData.best_option[0] == "go_random_delivery" || CollaboratorData.best_option[0] == "go_random_delivery") { }

    else if (MyData.best_option[0] == "go_put_down" || CollaboratorData.best_option[0] == "go_put_down") {
        if (MyData.best_option[0] == "go_put_down" && CollaboratorData.best_option[0] == "go_put_down") {
            if (MyData.best_option[1] == CollaboratorData.best_option[1] && MyData.best_option[2] == CollaboratorData.best_option[2]) {
                if (MyData.best_option[4] >= CollaboratorData.best_option[4]) {
                    let newDelivery = find_nearest_delivery({ x: CollaboratorData.best_option[1], y: CollaboratorData.best_option[2] })
                    CollaboratorData.best_option = ['go_put_down', newDelivery.x, newDelivery.y, "", CollaboratorData.best_option[4]]
                } else {
                    let newDelivery = find_nearest_delivery({ x: MyData.best_option[1], y: MyData.best_option[2] })
                    MyData.best_option = ['go_put_down', newDelivery.x, newDelivery.y, "", MyData.best_option[4]]
                }
            }
        }
    }
    else {
        if (MyData.best_option[3] === CollaboratorData.best_option[3]) {
            if (MyData.best_option[4] >= CollaboratorData.best_option[4]) {
                CollaboratorData.best_option = findBestOption(CollaboratorData.options, CollaboratorData.best_option[3])
            } else {
                MyData.best_option = findBestOption(MyData.options, MyData.best_option[3])
            }
        }
    }

    return true;
}

function calculate_pickup_utility(parcel, slavePos = null) {
    let scoreParcel = parcel.reward;
    MyData.scoreInMind = myAgent.get_inmind_score();
    let numParcelInMind = myAgent.parcelsInMind.length

    // let distance_parcel = 0;
    if (slavePos == null) {
        var distance_parcel = distanceBFS(parcel);
    } else {
        var distance_parcel = distanceBFS_notMe(slavePos, parcel)
    }

    let distance_delivery = distanceBFS_notMe(parcel, find_nearest_delivery());

    for (let parcelInMind of myAgent.parcelsInMind) {
        let rewardAtEnd = parcelInMind.reward - decade_frequency * (distance_parcel + distance_delivery);
        if (rewardAtEnd <= 0) {
            numParcelInMind = numParcelInMind - 1;
        }
    }

    let RewardParcel = scoreParcel - decade_frequency * distance_parcel;
    let RewardInMind = MyData.scoreInMind - ((decade_frequency * distance_parcel) * numParcelInMind);
    let utility = (RewardParcel + RewardInMind) - (decade_frequency * distance_delivery) * (numParcelInMind + 1);


    let min_distance_parcel_agent = Number.MAX_VALUE;
    let nearest_agent = "";
    for (let a of beliefset.values()) {
        if (distanceBFS_notMe(parcel, a) < min_distance_parcel_agent) {
            min_distance_parcel_agent = distanceBFS_notMe(parcel, a);
            nearest_agent = a.name;
        }
    }

    let mult_malus = 0.7;

    if (min_distance_parcel_agent < distance_parcel) {
        utility -= mult_malus * (distance_parcel - min_distance_parcel_agent);

    }

    return utility;
}

function calculate_putdown_utility() {
    MyData.inmind = myAgent.get_inmind_score();

    let nearest_delivery = find_nearest_delivery()
    let distanceDelivery = distanceBFS(nearest_delivery);
    let numParcelInMind = myAgent.parcelsInMind.length

    for (let parcelInMind of myAgent.parcelsInMind) {
        let rewardAtEnd = parcelInMind.reward - (decade_frequency * distanceDelivery);
        if (rewardAtEnd <= 0) {
            numParcelInMind = numParcelInMind - 1;
        }
    }

    var utility = MyData.scoreInMind - ((decade_frequency * distanceDelivery) * numParcelInMind);
    return [nearest_delivery, utility];
}

// Define global variables
const beliefset = new Map();

// Function to update beliefset when agents are sensed

client.onAgentsSensing(agents => {
    // Update beliefset with new agent information
    for (let a of agents) {
        beliefset.set(a.id, a);
    }
});

// function manhattan({ x: x1, y: y1 }, { x: x2, y: y2 }) {
//     const dx = Math.abs(Math.round(x1) - Math.round(x2))
//     const dy = Math.abs(Math.round(y1) - Math.round(y2))
//     return dx + dy;
// }

function distanceBFS({ x: x, y: y }) {
    return findPath_BFS(x, y).length;
}

function distanceBFS_notMe({ x: startX, y: startY }, { x: endX, y: endY }) {
    return findPath_BFS_notMe(startX, startY, endX, endY).length;
}

export function from_json_to_matrix(width, height, tiles, map) {
    var map = [];
    for (let i = 0; i < width; i++) {
        map[i] = [];
        for (let j = 0; j < height; j++) {
            map[i][j] = 0;                                       // '0' are blocked tiles (empty or not_tile)
            for (let k = 0; k < tiles.length; k++) {
                if (tiles[k].x == i && tiles[k].y == j) {
                    map[i][j] = 1;                               // '1' are walkable non-spawning tiles 
                    if (tiles[k].parcelSpawner) map[i][j] = 3;   // '3' are walkable spawning tiles  
                    if (tiles[k].delivery) map[i][j] = 2;        // '2' are delivery tiles
                }
            }
        }
    }
    return map;
}


client.onYou(({ id, name, x, y, score }) => {
    MyData.id = id
    MyData.name = name
    MyData.pos.x = Math.round(x);
    MyData.pos.y = Math.round(y);
    MyData.score = score
})



// var parcels = new Map()
client.onParcelsSensing(async (perceived_parcels) => {
    MyData.parcels = []
    for (let p of perceived_parcels) {
        MyData.parcels.push(p)
    }
})

var map = [];
var deliveryCoordinates = [];
client.onMap((width, height, tiles) => {
    // console.log("Map received: ", width, height, tiles.length)
    map = from_json_to_matrix(width, height, tiles, map);
    deliveryCoordinates = tiles.filter(t => t.delivery).map(t => ({ x: t.x, y: t.y }));
});

//* Find nearest delivery 
function find_nearest_delivery(ignoreCoordinates = undefined) {

    let min_distance = Number.MAX_VALUE;
    let nearest_delivery = { x: -1, y: -1 };
    for (var i = 0; i < deliveryCoordinates.length; i++) {
        if (distanceBFS(deliveryCoordinates[i]) < min_distance) {

            if (ignoreCoordinates != undefined && deliveryCoordinates[i].x == ignoreCoordinates.x && deliveryCoordinates[i].y == ignoreCoordinates.y) continue;

            min_distance = distanceBFS(deliveryCoordinates[i]);
            nearest_delivery = deliveryCoordinates[i];
        }
    }

    // console.log("nearest_delivery: ", nearest_delivery, "(I'm on x: ", me.x, " y: ", me.y, ")");
    return nearest_delivery;
}

//* Find random delivery 
function find_random_deliveryFarFromOther() {

    let max_distance = -1;
    let delivery_coordinates = { x: -1, y: -1 };
    
    if (MyData.role == "SLAVE") {       // SLAVE fa quello che vuole, va in una random a caso
        var random_delivery = deliveryCoordinates[Math.floor(Math.random() * deliveryCoordinates.length)];
        delivery_coordinates = { x: random_delivery.x, y: random_delivery.y };
        console.log("\nI'm a SLAVE, I'm going to a random delivery: ", delivery_coordinates);
    } else {
        for (let del of deliveryCoordinates){

            var distance = distanceBFS_notMe(del, CollaboratorData.pos);

            // console.log("del: ", del, " - other agent: ", CollaboratorData.pos);
            if (distance > max_distance){
                if (CollaboratorData.best_option[0] == "go_random_delivery" && CollaboratorData.best_option[1] == del.x && CollaboratorData.best_option[2] == del.y) {
                    continue;
                } else{
                    max_distance = distanceBFS_notMe(del, CollaboratorData.pos);
                    delivery_coordinates = { x: del.x, y: del.y };    
                }
                // console.log("\n---------> further delivery from ", CollaboratorData.role, " is: ", delivery_coordinates, " - distance: ", max_distance, "\n");
            }
        }
        console.log("\nI'm a MASTER, I'm going to a delivery far from the other agent: ", delivery_coordinates, " other agent: ", CollaboratorData.pos);
    }

    return deliveryCoordinates;
}


//* BFS
function getNeighbors(x, y) {
    const neighbors = [];
    const directions = [
        { dx: -1, dy: 0 },  // left
        { dx: 1, dy: 0 },   // right
        { dx: 0, dy: -1 },  // down
        { dx: 0, dy: 1 }    // up
    ];

    for (const direction of directions) {
        const neighborX = x + direction.dx;
        const neighborY = y + direction.dy;

        if (isValidPosition(neighborX, neighborY)) {
            neighbors.push({ x: neighborX, y: neighborY });
        }
    }

    return neighbors;
}

function isValidPosition(x, y) {
    x = Math.round(x);
    y = Math.round(y);
    const width = map.length;
    const height = map[0].length;

    return x >= 0 && x < width && y >= 0 && y < height && map[x][y] !== 0;
}

function findPath_BFS(endX, endY) {

    const visited = new Set();
    const queue = [];


    var startX = MyData.pos.x;
    var startY = MyData.pos.y;

    queue.push({ x: startX, y: startY, pathSoFar: [] });
    visited.add(`${startX},${startY}`);

    while (queue.length > 0) {
        const { x, y, pathSoFar } = queue.shift();

        if (x === endX && y === endY) {
            // Found the end point, return the path
            return [...pathSoFar, { x: endX, y: endY }]; // Include the end point in the path
        }

        const neighbors = getNeighbors(x, y);
        for (const neighbor of neighbors) {
            const { x: neighborX, y: neighborY } = neighbor;

            if (!visited.has(`${neighborX},${neighborY}`)) {
                visited.add(`${neighborX},${neighborY}`);
                queue.push({ x: neighborX, y: neighborY, pathSoFar: [...pathSoFar, { x, y }] });
            }
        }
    }

    // If no path is found, return an empty array
    return [];
}

function findPath_BFS_notMe(startX, startY, endX, endY) {

    const visited = new Set();
    const queue = [];

    queue.push({ x: startX, y: startY, pathSoFar: [] });
    visited.add(`${startX},${startY}`);

    while (queue.length > 0) {
        const { x, y, pathSoFar } = queue.shift();

        if (x === endX && y === endY) {
            // Found the end point, return the path
            return [...pathSoFar, { x: endX, y: endY }]; // Include the end point in the path
        }

        const neighbors = getNeighbors(x, y);
        for (const neighbor of neighbors) {
            const { x: neighborX, y: neighborY } = neighbor;

            if (!visited.has(`${neighborX},${neighborY}`)) {
                visited.add(`${neighborX},${neighborY}`);
                queue.push({ x: neighborX, y: neighborY, pathSoFar: [...pathSoFar, { x, y }] });
            }
        }
    }

    // If no path is found, return an empty array
    return [];
}


