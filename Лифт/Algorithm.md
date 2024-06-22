## LOOK
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
