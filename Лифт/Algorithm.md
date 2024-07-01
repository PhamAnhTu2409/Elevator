## FCFS + SSTF
```javascript
{
    init: function(elevators, floors) {
        elevators.forEach(function(e) {    
            e.isDestination = function(floorNum) {
                return e.destinationQueue.indexOf(floorNum) != -1;
            }

            e.on("floor_button_pressed", function(floorNum) {
                if (!e.isDestination(floorNum))
                    e.goToFloor(floorNum);
            });
        
            e.on("passing_floor", function(floorNum, direction) {
                if (e.isDestination(floorNum)) {
                    e.destinationQueue = e.destinationQueue.filter(function(f) { return f != floorNum; });
                    e.goToFloor(floorNum, true);
                }
            });
        });
            
        floors.forEach(function(f) {
            f.on("up_button_pressed down_button_pressed", function() {
                if (elevators.some(function(e) { return e.isDestination(f.floorNum()); }))
                    return;
                
                var e = elevators[0];
                
                for(var i = 0; i < elevators.length; i++)
                    if (elevators[i].destinationQueue.length < e.destinationQueue.length)
                        e = elevators[i];
                
                if (!e.isDestination(f.floorNum()))
                    e.goToFloor(f.floorNum());
            });
        });
    },
    update: function(dt, elevators, floors) { }
}
```
## LOOK + 70%
```javascript
{
    init: function(elevators, floors) {
        for (var i=0;i<floors.length;i++){
            (function () {
                var f = floors[i];
                f.upReq = false;
                f.downReq = false;
                f.on("up_button_pressed", function() {f.upReq = true;});
                f.on("down_button_pressed", function() {f.downReq = true;});
            }());
        }
        for (i=0;i<elevators.length;i++){
            (function () {
                var e = elevators[i];
                e.task = -1;
                e.on("passing_floor", function(f,d) {
                    if ((floors[f].upReq && d=="up" || floors[f].downReq && d=="down") && e.loadFactor()<0.7 || e.destinationQueue.includes(f)){
                        e.destinationQueue.unshift(f);
                        e.checkDestinationQueue();
                    }
                });
                e.on("stopped_at_floor", function(f) {
                    if(e.task>=0 && e.task!=f){
                        if(floors[e.task].buttonStates.up)floors[e.task].upReq=true;
                        if(floors[e.task].buttonStates.down)floors[e.task].downReq=true;
                    }
                    e.task=-1;
                    if (e.loadFactor()==0.0) {e.destinationQueue=[];}
                    e.destinationQueue = e.destinationQueue.filter(function(ele){return ele != f;});
                    e.checkDestinationQueue();
                    e.goingUpIndicator(true);
                    e.goingDownIndicator(true);
                    if (e.destinationQueue.length>0){
                        if (e.destinationQueue[0]>f){e.goingDownIndicator(false);}
                        if (e.destinationQueue[0]<f){e.goingUpIndicator(false);}
                    }
                    if (e.goingUpIndicator()) {floors[f].upReq=false;}
                    if (e.goingDownIndicator()) {floors[f].downReq=false;}
                });
                e.on("floor_button_pressed", function(f) {e.goToFloor(f);});
            }());
        }
    },
    update: function(dt, elevators, floors) {
        for (var i=0; i<elevators.length; i++){
            if (elevators[i].task>=0 && !floors[elevators[i].task].buttonStates.up && !floors[elevators[i].task].buttonStates.down){elevators[i].task=-1;}
            if (elevators[i].loadFactor()==0.0 && elevators[i].task==-1) {
                for (var j=floors.length-1;j>0;j--) {if (floors[j].upReq || floors[j].downReq) {break;}}
                floors[j].upReq = false;
                floors[j].downReq = false;
                elevators[i].task = j;
                elevators[i].stop();
                elevators[i].goToFloor(j);
            }
        }
    }
}
```
## LOOK Score
```javascript
{
    init: function(elevators, floors) {

        // set to true to optimize algorithm for moves
        var optimizeMoves = false;
        // set to true to optimize algorithm for wait
        var optimizeWait = false;

        // check floors & elevators for events
        map(floors, checkForButtonPress);
        map(elevators, checkFloorButton);
        map(elevators, checkPassingFloor);
        if (!optimizeMoves && !optimizeWait) {
            map(elevators, checkForIdle);
        }

        // button pressed at floor
        function checkForButtonPress(floor) {
            // for now we don't differentiate between up and down passengers
            floor.on("up_button_pressed down_button_pressed", function() {
                assignElevator(floor);
            });
        }

        // button pressed inside elevator
        function checkFloorButton(elevator) {
            elevator.on("floor_button_pressed", function (floorNum) {
                if (elevator.destinationQueue.indexOf(floorNum) === -1) {
                    // go to floor if we're not already headed there
                    elevator.goToFloor(floorNum);
                }
            });
        }

        // if passing floor in destination queue, lets
        // stop there, then be on our way
        function checkPassingFloor(elevator) {
            elevator.on("passing_floor", function (floorNum, direction) {
                var queue = elevator.destinationQueue;
                var index = queue.indexOf(floorNum);
                if (index > -1) {
                    var floor = floors[floorNum];
                    var goingUp = floor.buttonStates.up === 'activated';
                    var goingDown = floor.buttonStates.down === 'activated';
                    var passengerOnFloor = goingUp || goingDown;
                    var floorInRequests = elevator.getPressedFloors().indexOf(floorNum) > -1;
                    // remove the floor as we decide what to do with it
                    queue.splice(index, 1);
                    elevator.checkDestinationQueue();
                    // passenger has requested this floor, so stop
                    if (floorInRequests) {
                        elevator.goToFloor(floorNum, true);
                    } else if (passengerOnFloor) {
                        // passenger is waiting at this floor,
                        // decide to stop or not
                        if (elevator.loadFactor() < .7) {
                            // our elevator is not too crowded, so lets stop
                            elevator.goToFloor(floorNum, true);
                        } else {
                            // too crowded now
                            if (optimizeMoves) {
                                // add it back to our queue for later
                                elevator.goToFloor(floorNum);
                            } else {
                                // give it to another elevator
                                assignElevator(floor);
                            }
                        }
                    }
                    // floor was not in requests, and passenger was
                    // not on floor, so we dont do anything with the
                    // floor number, just leave it removed
                }
            });
        }

        // if idle, send back to ground floor
        function checkForIdle(elevator) {
            elevator.on("idle", function () {
                elevator.goToFloor(0);
            });
        }

        // determine best elevator to send
        // based on suitability score
        function assignElevator(floor) {
            var floorNo = floor.floorNum();
            var elevatorScores = map(elevators, scoreElevators);
            var bestScore = reduce(elevatorScores, findBest, null);
            var elevator = bestScore[0];

            elevator.goToFloor(floorNo);

            function findBest(current, elevatorScore) {
                // lower ranking is better
                if (current === null) {
                    return elevatorScore;
                } else if (elevatorScore[1] < current[1]) {
                    return elevatorScore;
                } else {
                    return current;
                }
            }

            function scoreElevators(elevator) {
                var score;
                var queue = elevator.destinationQueue;
                var distanceFromFloor = getDistance();
                var load = elevator.loadFactor();

                score = distanceFromFloor;
                // apply load factor to score
                if (optimizeMoves) {
                    // if move optimization is enabled,
                    // then we favor fuller elevators
                    score -= (queue.length * (1 + load));
                } else if (optimizeWait) {
                    score += (queue.length * (1 + load));
                } else {
                    // otherwise favor lighter elevators
                    score += (queue.length * (1 + load));
                }

                return [elevator, score];

                function getDistance() {
                    if (queue.length === 0) {
                        // no destinations scheduled
                        // so lets use current floor
                        return Math.abs(elevator.currentFloor() - floorNo);
                    }
                    // search destination queue
                    // for a stop close to floorNo
                    return reduce(queue, function (current, scheduledLocation) {
                        var distance = Math.abs(scheduledLocation - floorNo);
                        if (current === null) {
                            return distance;
                        } else if (distance < current) {
                            return distance;
                        } else {
                            return current;
                        }
                    }, null);
                }
            }
        }

        //functional array helpers

        function map(array, func) {
            var mapped = [];
            array.forEach(function (element) {
                mapped.push(func(element));
            });
            return mapped;
        }

        function reduce(array, combine, start) {
            var current = start;
            map(array, function (element) {
                current = combine(current, element);
            });
            return current;
        }
    },
    update: function(dt, elevators, floors) {
        // We normally don't need to do anything here
    }
}
```
## Code 4
```javascript
{
    init: function(elevators, floors) {
        var minimal_load = 0;
        var up_queue = [];
        var down_queue = [];

        elevators.forEach(function(elevator) {
            elevator.on("idle", function() {
                // By default, do nothing.
                var floor = elevator.currentFloor();

                if ( down_queue.length > 0 ) {
                    floor = down_queue.pop();
                } else if ( up_queue.length > 0 ) {
                    floor = up_queue.pop();
                }

                elevator.goToFloor(floor);
            });

            elevator.on("floor_button_pressed", function(floorNum) {
                elevator.goToFloor(floorNum);
            });


            elevator.on("stopped_at_floor", function(floorNum) {
                if ( elevator.loadFactor() < minimal_load ) {
                    elevator.goToFloor(floorNum, true);
                }
            });

            elevator.on("passing_floor", function(floorNum, direction) {
                var queue = elevator.destinationQueue;

                // Can we stop at this floor?
                if ( !isFull(elevator) ) {
                    var up = up_queue.indexOf(floorNum);
                    var down = down_queue.indexOf(floorNum);

                    // if we're going up and they're going up...
                    if ( direction == "up" && up > -1 ) {
                        up_queue.splice(up, 1);
                        queue.push(floorNum);
                    } else if ( direction == "down" && down > -1 ) {
                        down_queue.splice(down, 1);
                        queue.push(floorNum)
                    }
                }

                // De-dupe
                queue = _.uniq(queue);

                // Sort it. Floors in same direction first, nearest first.
                queue.sort(function(left, right) {
                    // If either of these are the floor we're "passing", that wins.
                    if ( left == floorNum && right != floorNum ) return -1;
                    if ( left != floorNum && right == floorNum ) return 1;

                    if ( direction == "down" ) {
                        if ( left < floorNum && right < floorNum ) return left - right;
                        if ( left > floorNum && right > floorNum ) return left - right;
                        if ( left < floorNum && right > floorNum ) return -1;
                        if ( left > floorNum && right < floorNum ) return 1;
                    } else {
                        if ( left < floorNum && right < floorNum ) return left - right;
                        if ( left > floorNum && right > floorNum ) return left - right;
                        if ( left < floorNum && right > floorNum ) return 1;
                        if ( left > floorNum && right < floorNum ) return -1;
                    }

                    // fallthrough -- equal.
                    return 0;
                });

                // Let's push it back in
                elevator.destinationQueue = queue;
                elevator.checkDestinationQueue();
            });
        });


        floors.forEach(function(floor) {
            floor.on("up_button_pressed", function() {
                up_queue.push(floor.floorNum());
            });

            floor.on("down_button_pressed", function() {
                down_queue.push(floor.floorNum());
            });
        });

        var isFull = function(elevator) { return elevator.loadFactor() >= 0.7; };

    },
    update: function(dt, elevators, floors) {
        // We normally don't need to do anything here
    }
}
```

