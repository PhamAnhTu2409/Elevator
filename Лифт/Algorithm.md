## LOOK + CLosest Cabin
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
## Code 2
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
## Code 3
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
        var top = floors.length - 1;
        var floor_pushup_list = [];
        var floor_pushdown_list = [];
        // tool
        Array.prototype.remove = function(val) { 
            var index = this.indexOf(val); 
            if (index > -1) { 
                this.splice(index, 1); 
            } 
        };
        // log
        var mode = "0";
        function myalert(msg) {
            if (mode == "1") {
                window.alert(msg);
            }
        };

        // elevator
        for (i=0;i< elevators.length; i++) {
            let j =i;
            // Whenever the elevators[j] is idle (has no more queued destinations) ...
            elevators[j].on("idle", function() {
                // let's go to all the floors (or did we forget one?)

                if (elevators[j].currentFloor() == 0)
                    elevators[j].goToFloor(top);
                else if (elevators[j].currentFloor() == top)
                    elevators[j].goToFloor(0);
            });        
            elevators[j].on("passing_floor", function(floorNum, direction) {
                var stop=false;
                if (elevators[j].loadFactor() < 0.7 &&
                    ((direction=="up" && floor_pushup_list.includes(floorNum)) ||
                    (direction=="down" && floor_pushdown_list.includes(floorNum)))) {
                    stop = true;
                }
                if(stop || elevators[j].getPressedFloors().includes(floorNum)) {
                    elevators[j].goToFloor(floorNum,true);
                    if (elevators[j].destinationQueue[1] > floorNum) {
                        elevators[j].goingUpIndicator(true);
                        elevators[j].goingDownIndicator(false);
                    } else {
                        elevators[j].goingUpIndicator(false);
                        elevators[j].goingDownIndicator(true);
                    }
                    if(direction=="up") {
                        floor_pushup_list.remove(floorNum);
                    }
                    if(direction=="down") {
                        floor_pushdown_list.remove(floorNum);
                    }
                }
            });
            elevators[j].on("stopped_at_floor", function(floorNum) {
                if (floorNum == 0) {
                    elevators[j].goingUpIndicator(true);
                    elevators[j].goingDownIndicator(false);  
                } else if (floorNum == top) {
                    elevators[j].goingUpIndicator(false);
                    elevators[j].goingDownIndicator(true);  
                }
            })

            elevators[j].on("floor_button_pressed", function(floorNum) {
                // Maybe tell the elevators[j] to go to that floor?
            });
        }

        // floor
        for (i=0;i< floors.length; i++) {
            let j = i;
            floors[j].on("up_button_pressed", function (){
                // Maybe tell an elevators[j] to go to this floor?
                //wmyalert(j+"th floor push up");
                if (!floor_pushup_list.includes(j))
                    floor_pushup_list.push(j);

            });
            floors[j].on("down_button_pressed ", function() {
                // Maybe tell an elevators[j] to go to this floor?
                //myalert(j+"th floor push down");
                if (!floor_pushdown_list.includes(j))
                    floor_pushdown_list.push(j);
            });
        }

    },
    update: function(dt, elevators, floors) {
        // We normally don't need to do anything here
    }
}
```
## Code 5 
```

```
