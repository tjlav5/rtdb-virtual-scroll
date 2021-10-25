export function fillObj(obj: {}, depth: number) {
    obj["foo0"] = 1;
    obj["bar0"] = false;
    obj["foo2"] = -99999;
    obj["bar2"] = true;
    obj["foo3"] = 10002525.10002525;
    obj["bar3"] = "test";
    obj["foo4"] = "hello world hello world hello world hello world";
    obj["bar4"] = [1,2,3,4,5,6,7,8,9,0];
    if(depth > 0) {
        obj["foo5"] = {};
        fillObj(obj["foo5"], depth-1);
        obj["bar5"] = [{},{},{},{},{}];
        for(var i=0; i<obj["bar5"].length; i++) {
            fillObj(obj["bar5"][i], depth-1);
        }
    }
    return obj;
}