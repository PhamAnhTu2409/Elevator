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
##
```
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
