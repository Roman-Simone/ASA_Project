
function printMap(width, height, map){
    console.log("map:");
    for (let j = height - 1; j >= 0; j--) {
        let row = "";
        for (let i = 0; i < width; i++) {
            row += map[i][j] + " ";
        }
        console.log(row);
    }
}

export function from_json_to_matrix(width, height, tiles, map){
    var map = [];
    for (let i = 0; i < width; i++) {
        map[i] = [];
        for (let j = 0; j < height; j++) {
            map[i][j] = 0;                                       // '0' are blocked tiles (empty or not_tile)
            for(let k=0; k<tiles.length; k++){
                if(tiles[k].x == i && tiles[k].y == j){
                    map[i][j] = 3;                               // '3' are walkable non-spawning tiles 
                    if (tiles[k].parcelSpawner) map[i][j] = 1;   // '1' are walkable spawning tiles  
                    if (tiles[k].delivery) map[i][j] = 2;        // '2' are delivery tiles
                }
            }
        }
    }

    printMap(width, height, map);
    return map;
}



function manhattan(me_x1, me_y1, target_x2, target_y2) {
    return Math.abs(me_x1 - target_x2) + Math.abs(me_y1 - target_y2);
}


export function find_nearest(me_x, me_y, map){

    let dist_0 = 1000000;
    let dist_1 = 1000000;
    let dist_2 = 1000000;   
    let dist_3 = 1000000;

    let coordinates = [];
    for (var i = 0; i < 4; i++) {
        coordinates.push([-1, -1]);
    }

    for (var i = 0; i < map.length; i++) {
        for (var j = 0; j < map[i].length; j++) {
            if(i == me_x && j == me_y){
                continue;
            }
            switch (map[i][j]) {
                case 0:
                    if(manhattan(me_x, me_y, i, j) < dist_0){
                        dist_0 = manhattan(me_x, me_y, i, j);
                        coordinates[0] = [i, j];
                    }
                    break;
                case 1:
                    if(manhattan(me_x, me_y, i, j) < dist_1){
                        dist_1 = manhattan(me_x, me_y, i, j);
                        coordinates[1] = [i, j];
                    }
                    break;
                case 2:
                    if(manhattan(me_x, me_y, i, j) < dist_2){
                        dist_2 = manhattan(me_x, me_y, i, j);
                        coordinates[2] = [i, j];
                    }
                    break;
                case 3:
                    if(manhattan(me_x, me_y, i, j) < dist_3){
                        dist_3 = manhattan(me_x, me_y, i, j);
                        coordinates[3] = [i, j];
                    }
                    break;
                default:
                    // Handle other cases if needed
                    break;
            }
        }
    }

    return coordinates;
}


