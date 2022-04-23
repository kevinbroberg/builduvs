/* TODO: factor into a single function with an array of inputs, and routes them based on proportions */
export function hiOrLow(e, hi, low) {
    var rect = e?.target?.getBoundingClientRect();
    if(!rect) {
        console.log(`sry no bounding rectange, only counting up`)
        hi()
        return 
    }
    // var x = e.clientX - rect.left; //x position within the element. - unused
    var y = e.clientY - rect.top;  //y position within the element.
    var mid = (rect.bottom - rect.top)/2
    // console.log(`Computed ${y} from client ${e.clientY} rect ${rect.top} and relative to ${mid}`);
    // console.log(`do high? ${y < mid}`)
    if(y < mid) {
        hi()
    } else {
        low()
    }
}

export function click3(e, hi, mid, low) {
    var target = e?.target
    // this is AWFUL practice I'm sure...
    target = target.tagName === "DIV" ? target : target.parentNode
    var rect = target?.getBoundingClientRect()
    if(!rect) {
        console.log(`sry no bounding rectange, only counting up ${target}`)
        hi()
        return 
    }
    // var x = e.clientX - rect.left; //x position within the element. - unused
    var y = e.clientY - rect.top;  //y position within the element.
    var inc = (rect.bottom - rect.top)/3
    var t = inc, m = t + inc
    // console.log(`Computed ${y} from client ${e.clientY} rect ${rect.top} and relative to ${mid}`);
    console.log(`${e.target} ${y} click bottom ${rect.bottom} top ${rect.top} step ${inc} first boundary ${t} second ${m}`)
    if(y < t) {
        hi()
    } else if (y < m) {
        mid()
    } else {
        low()
    }
}