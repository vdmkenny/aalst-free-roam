// City-wide population; navigation keeps cars on arterials and shoppers central.
export const npcPopulation=Object.freeze({car:480,walk:500,bike:100});

// Named urban corridors retain traffic even where OSM uses a lower road class.
export const busyCarRoad=road=>/steenweg|parklaan|bethune|capucienen/i.test((road?.n||'').normalize('NFD').replace(/[\u0300-\u036f]/g,''));
