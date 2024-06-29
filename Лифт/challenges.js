
var requireUserCountWithinTime = function(userCount, timeLimit) {
    return {
        description: "Лифты перевозят <span >" + userCount + "</span> человек.",// in <span class='emphasis-color'>" + timeLimit.toFixed(0) + "</span> seconds or less",
        evaluate: function(world) {
            if(world.elapsedTime >= timeLimit || world.transportedCounter >= userCount) {
                return world.elapsedTime <= timeLimit && world.transportedCounter >= userCount;
            } else {
                return null;
            }
        },
        setUserCount: function(newUserCount) {
            userCount = newUserCount;
        },
    };
};


var requireDemo = function() {
    return {
        description: "Perpetual demo",
        evaluate: function() { return null; }
    };
};

/* jshint laxcomma:true */
var challenges = [
     {options: {floorCount: 10  , elevatorCount: 4, spawnRate: 20}, condition: requireUserCountWithinTime(300, 3600)}
    
];
/* jshint laxcomma:false */
function updateChallenge(newUserCount) {
    challenges[0].condition = requireUserCountWithinTime(newUserCount, 3600);
    console.log("Updated challenges with new user count:", challenges[0]);
}