// force-graph runs on d3-force-3d, which ships no types; only the positional forces the mind map adds are declared.
declare module 'd3-force-3d' {
 export interface PositionForce{(alpha:number):void;initialize(nodes:unknown[],...args:unknown[]):void;strength(strength:number|((node:unknown)=>number)):PositionForce;x(x:number):PositionForce;y(y:number):PositionForce}
 export function forceX(x?:number):PositionForce;
 export function forceY(y?:number):PositionForce;
}
