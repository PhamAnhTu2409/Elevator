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
## C-SCAN
```javascript
{
    init: function(elevators, floors) {

        // check floors & elevators for events
        floors.forEach(checkForButtonPress);
        elevators.forEach(checkFloorButton);
        elevators.forEach(checkPassingFloor);
        elevators.forEach(checkForIdle);

        // button pressed at floor
        function checkForButtonPress(floor) {
            floor.on("up_button_pressed down_button_pressed", function() {
                assignElevator(floor);
            });
        }

        // button pressed inside elevator
        function checkFloorButton(elevator) {
            elevator.on("floor_button_pressed", function(floorNum) {
                if (!elevator.destinationQueue.includes(floorNum)) {
                    elevator.goToFloor(floorNum);
                }
            });
        }

        // if passing floor in destination queue, stop there, then be on our way
        function checkPassingFloor(elevator) {
            elevator.on("passing_floor", function(floorNum, direction) {
                let queue = elevator.destinationQueue;
                if (queue.includes(floorNum)) {
                    let floor = floors[floorNum];
                    let goingUp = floor.buttonStates.up === 'activated';
                    let goingDown = floor.buttonStates.down === 'activated';
                    let passengerOnFloor = goingUp || goingDown;
                    let floorInRequests = elevator.getPressedFloors().includes(floorNum);
                    queue.splice(queue.indexOf(floorNum), 1);
                    elevator.checkDestinationQueue();
                    if (floorInRequests || (passengerOnFloor && elevator.loadFactor() < 0.7)) {
                        elevator.goToFloor(floorNum, true);
                    } else if (passengerOnFloor) {
                        assignElevator(floor);
                    }
                }
            });
        }

        // if idle, send back to ground floor
        function checkForIdle(elevator) {
            elevator.on("idle", function() {
                if (elevator.currentFloor() !== 0) {
                    elevator.goToFloor(0);
                } else {
                    handleIdleElevator(elevator);
                }
            });
        }

        // determine best elevator to send
        // based on suitability score
        function assignElevator(floor) {
            let floorNo = floor.floorNum();
            let closestElevator = null;
            let minDistance = Infinity;

            elevators.forEach(elevator => {
                if (elevator.loadFactor() < 1) {
                    let distance = calculateDistance(elevator, floorNo);
                    if (distance < minDistance) {
                        minDistance = distance;
                        closestElevator = elevator;
                    }
                }
            });

            if (closestElevator) {
                closestElevator.goToFloor(floorNo);
            }

            function calculateDistance(elevator, targetFloor) {
                let currentFloor = elevator.currentFloor();
                if (elevator.destinationQueue.length === 0) {
                    return Math.abs(currentFloor - targetFloor);
                }

                let queue = elevator.destinationQueue.slice();
                queue.push(targetFloor);
                queue.sort((a, b) => a - b);

                if (elevator.goingUpIndicator()) {
                    if (targetFloor >= currentFloor) {
                        return targetFloor - currentFloor;
                    } else {
                        return (floors.length - currentFloor) + targetFloor;
                    }
                } else {
                    if (targetFloor <= currentFloor) {
                        return currentFloor - targetFloor;
                    } else {
                        return currentFloor + (floors.length - targetFloor);
                    }
                }
            }
        }

        // handle idle elevator, move it to serve requests in C-SCAN manner
        function handleIdleElevator(elevator) {
            let floorsToVisit = [];
            floors.forEach(floor => {
                if (floor.buttonStates.up === 'activated' || floor.buttonStates.down === 'activated') {
                    floorsToVisit.push(floor.floorNum());
                }
            });

            if (floorsToVisit.length > 0) {
                floorsToVisit.sort((a, b) => a - b);
                if (elevator.goingUpIndicator()) {
                    elevator.destinationQueue = floorsToVisit;
                } else {
                    elevator.destinationQueue = floorsToVisit.reverse();
                }
                elevator.checkDestinationQueue();
            }
        }
    },
    update: function(dt, elevators, floors) {
        // We normally don't need to do anything here
    }
}
```
## LOOK score 
```javascript
{
    update: function(dt, elevators, floors) {},
    init: function(elevators, floors) {
        var timer = 1;                    // Global timer.
        var summonUp = {}, summonDn = {}; // Where elevator has been summoned. {floor:timer}
        var updateSchedules = function() {
            // Goals: For each "idle" elevator (currentTarget = -1),
            //        a new target _must_ be assigned to keep the machine running.
            //        For every other elevator, a new target _may_ be assigned.
            //        Targets are assigned using e.reschedule(targetfloornumber).
            // For every elevator, evaluate each floor as a candidate new target.
            // Then, reschedule the elevator that would most benefit from a route change.
            for(var round=0; round<100; ++round)
            {
                var bestBenefit = {score:0, elevator:null, target:-1}
                elevators.forEach(function(e) {
                    var choices = {}
                    floors.forEach(function(f) {
                        var fn = f.floorNum(), score = 0;
                        // Sum the total age of passengers' wishes to go to this floor
                        if(e.wishes[fn]) score += 10*Math.pow(timer-e.wishes[fn], 2);
                        // Sum the summons to this floor, if we can handle it
                        var free = Math.max(0, (e.wishes[fn] ? 0.7 : 0.3) - e.loadFactor());
                        if(e.goingUpIndicator() && summonUp[fn])   score += 4*Math.pow(timer-summonUp[fn], 1.4) * free;
                        if(e.goingDownIndicator() && summonDn[fn]) score += 4*Math.pow(timer-summonDn[fn], 1.4) * free;
                        // Subtract the number of elevators going to this floor,
                        // each multiplied by their remaining distance
                        if(!e.wishes[fn])
                            elevators.forEach(function(e2) {
                                if(e2.currentTarget == fn && e.elevatorNumber != e2.elevatorNumber
                                && (!summonUp[fn] || e2.goingUpIndicator())
                                && (!summonDn[fn] || e2.goingDownIndicator()))
                                    score -= 50 * (1 - Math.abs(e2.nearestFloor - fn) / floors.length)
                            })
                        // Add the estimated time to reach that floor
                        var distance = Math.abs(e.nearestFloor - fn);
                        // If the elevator would have to change directions, add some cost to the distance
                        if(e.currentTarget >= 0 && fn != e.nearestFloor
                        && (e.currentTarget < e.currentOrigin) != (fn < e.nearestFloor))
                            distance += 2;
                        choices[fn] = score - Math.pow(distance / floors.length, 1.0)
                    })
                    var currentScore = e.currentTarget >= 0 ? choices[e.currentTarget] : -1e9;
                    for(var fn in choices)
                        if((choices[fn] - currentScore) > bestBenefit.score)
                            bestBenefit = {score:(choices[fn] - currentScore), elevator:e, target:fn}
                })
                if(bestBenefit.target < 0 || bestBenefit.target == bestBenefit.elevator.currentTarget) break;
                bestBenefit.elevator.reschedule(bestBenefit.target);
            }
            // Enact reschedulings:
            elevators.forEach(function(e) { e.pending_reschedule() })
        };
        var updateNearest = function() {
            elevators.forEach(function(e) { e.nearestFloor = e.currentFloor() })
        }
        var index = 0;
        elevators.forEach(function(e) {
            e.elevatorNumber = index++;
            e.currentOrigin  = e.currentFloor()
            e.currentTarget  = -1; // -1 = current state: idle
            e.nearestFloor   = e.currentOrigin;
            e.wishes         = {} // Where passengers want to go. {floor:timer}
            e.pending_reschedule = function() {}
            // Reschedule: Discard current schedule and target a new floor
            //             fn = floor number
            e.reschedule = function(fn) {
                e.currentOrigin    = e.nearestFloor;
                e.currentTarget    = fn;
                e.pending_reschedule = function() { e.destinationQueue = []; e.goToFloor(fn); e.pending_reschedule = function() {} }
            };
            // UpdateArrows: Update the arrow indicators for the elevator.
            e.updateArrows = function(whence) {
                var up = false, dn = false;
                for(fn in e.wishes) {
                    if(fn == e.currentTarget) continue;
                    if(fn > whence) up = true;
                    if(fn < whence) dn = true;
                }
                e.goingUpIndicator(up || !dn);
                e.goingDownIndicator(dn || !up);
            }
            e.on("idle", function()            { e.currentTarget = -1; updateNearest(); updateSchedules() })
            e.on("passing_floor", function(fn) { e.updateArrows(e.currentTarget); updateNearest(); e.nearestFloor = fn; updateSchedules() })
            e.on("stopped_at_floor", function(fn) {
                delete e.wishes[fn]; 
                e.currentTarget = -1; // state: idle
                e.currentOrigin = fn;
                e.updateArrows(e.currentOrigin);
                if(e.goingUpIndicator()) delete summonUp[fn];
                if(e.goingDownIndicator()) delete summonDn[fn];
                // Don't run updateSchedules() here; idle() will be called immediately hereafter anyway.
            })
            e.on("floor_button_pressed", function(fn) { e.wishes[fn] = timer++; })
        })
        floors.forEach(function(f) {
            var fn = f.floorNum();
            f.on("up_button_pressed",   function() { summonUp[fn] = timer++; updateSchedules() })
            f.on("down_button_pressed", function() { summonDn[fn] = timer++; updateSchedules() })
        })
    }
}
```
## Round Robin 
```
{
    init: function(elevators, floors) {
        var rotator = 0;
        _.each(floors, function(floor) {
            floor.on("up_button_pressed down_button_pressed", function() {
                var elevator = elevators[(rotator++) % elevators.length];
                elevator.goToFloor(floor.level);
            }); 
        });
        _.each(elevators, function(elevator) {
            elevator.on("floor_button_pressed", function(floorNum) {
                elevator.goToFloor(floorNum);
            });
            elevator.on("idle", function() {
                elevator.goToFloor(0);
            });
        });
    },
    update: function(dt, elevators, floors) {
    }
}
```
