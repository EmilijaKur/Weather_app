
const OPENWEATHER_API_KEY = "ac82131331ea9823d764bb12352998c6"; // <-- your OpenWeatherMap key here

const searchInput = document.getElementById("searchInput");
const searchBtn = document.getElementById("searchBtn");
const geoBtn = document.getElementById("geoBtn");
const unitSelect = document.getElementById("unitSelect");
const favAddBtn = document.getElementById("favAddBtn");
const favList = document.getElementById("favList");
const locationLabel = document.getElementById("locationLabel");
const statusDiv = document.getElementById("status");
const currentWeatherDiv = document.getElementById("currentWeather");
const hourlyForecastDiv = document.getElementById("hourlyForecast");
const dailyForecastDiv = document.getElementById("dailyForecast");
const comparisonChartCanvas = document.getElementById("comparisonChart");

let coords = null;
let favorites = JSON.parse(localStorage.getItem("favorites") || "[]");
let chart = null;

function saveFavorites() {
  localStorage.setItem("favorites", JSON.stringify(favorites));
  renderFavorites();
}

function cToUnit(c, unit) {
  if (unit === "C") return `${c.toFixed(1)}°C`;
  if (unit === "F") return `${(c * 9/5 + 32).toFixed(1)}°F`;
  if (unit === "K") return `${(c + 273.15).toFixed(1)}K`;
}

function changeTheme(temp, isDay) {
  const body = document.body;
  body.classList.remove("cold", "warm", "hot", "night");
  if (!isDay) {
    body.classList.add("night");
    return;
  }
  if (temp < 5) body.classList.add("cold");
  else if (temp < 15) body.classList.add("warm");
  else if (temp > 15) body.classList.add("hot");
}

function iconForWeather(code, hour, isDay) {
  const basePath = "./assets/";
  let isNight = hour < 6 || hour > 18; 
  if (code === 0) return isDay ?   `${basePath}moon.svg` : `${basePath}sunny.svg`;
  if ([1,2,3].includes(code)) return isDay ?  `${basePath}foggy_moon.svg` : `${basePath}sunny_cloud.svg`;
  if ([45,48].includes(code)) return `${basePath}cloud.svg`;
  if ([51,53,55].includes(code)) return `${basePath}cloudy_rain.svg`;
  if ([61,63,65,80,81,82].includes(code)) return `${basePath}rain_shower.svg`;
  if ([71,73,75,85,86].includes(code)) return `${basePath}snow.svg`;
  return `${basePath}cloud.svg`; 
}

function renderFavorites() {
  favList.innerHTML = "";
  if (favorites.length === 0) {
    favList.innerHTML = "<li>No favorites yet</li>";
    return;
  }
  favorites.forEach((f, i) => {
    const li = document.createElement("li");
    const btnLoad = document.createElement("button");
    btnLoad.textContent = f.label;
    btnLoad.onclick = () => {
      coords = { lat: f.lat, lon: f.lon };
      locationLabel.textContent = f.label;
      loadWeather();
    };
    const btnRemove = document.createElement("button");
    btnRemove.textContent = "✕";
    btnRemove.onclick = () => {
      favorites.splice(i, 1);
      saveFavorites();
    };
    li.appendChild(btnLoad);
    li.appendChild(btnRemove);
    favList.appendChild(li);
  });
}
renderFavorites();

geoBtn.onclick = () => {
  if (!navigator.geolocation) {
    statusDiv.textContent = "Geolocation not supported.";
    return;
  }
  navigator.geolocation.getCurrentPosition(
    pos => {
      coords = { lat: pos.coords.latitude, lon: pos.coords.longitude };
      locationLabel.textContent = "My location";
      loadWeather();
    },
    err => {
      statusDiv.textContent = err.message;
    }
  );
};

searchBtn.onclick = async () => {
  const q = searchInput.value.trim();
  if (!q) return;
  statusDiv.textContent = "Searching...";
  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}`);
    const data = await res.json();
    if (data.length === 0) {
      statusDiv.textContent = "No results found.";
      return;
    }
    const first = data[0];
    coords = { lat: parseFloat(first.lat), lon: parseFloat(first.lon) };
    locationLabel.textContent = first.display_name;
    loadWeather();
  } catch (e) {
    statusDiv.textContent = "Search failed.";
  }
};

favAddBtn.onclick = () => {
  if (!coords) return;
  const label = locationLabel.textContent;
  if (favorites.some(f => f.label === label)) return;
  favorites.push({ label, lat: coords.lat, lon: coords.lon });
  saveFavorites();
};

async function loadWeather() {
  if (!coords) return;
  const { lat, lon } = coords;
  statusDiv.textContent = "Loading weather...";

  try {
   
    const omUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,is_day,precipitation,weather_code,wind_speed_10m,wind_direction_10m&hourly=temperature_2m,relative_humidity_2m,precipitation,wind_speed_10m,weather_code,wind_direction_10m,is_day&daily=temperature_2m_max,temperature_2m_min,wind_speed_10m_max,precipitation_sum&timezone=auto`;
    const omData = await fetch(omUrl).then(r => r.json());

    
    const sevenUrl = `https://www.7timer.info/bin/api.pl?lon=${lon}&lat=${lat}&product=meteo&output=json`;
    const sevenData = await fetch(sevenUrl).then(r => r.json());

    const owUrl = `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&units=metric&appid=${OPENWEATHER_API_KEY}`;
    const owData = await fetch(owUrl).then(r => r.json());

    //console.log(" OpenWeatherMap data loaded:", owData);

    renderWeather(omData, sevenData, owData);
    statusDiv.textContent = "";
  } catch (e) {
    console.error("Failed to load weather:", e);
    statusDiv.textContent = "Failed to load weather.";
  }
}
function renderWeather(om, seven, ow) {
  const unit = unitSelect.value;
  currentWeatherDiv.innerHTML = "";
  hourlyForecastDiv.innerHTML = "";
  dailyForecastDiv.innerHTML = "";

  const currentTemp = om?.current_weather?.temperature ?? om.hourly?.temperature_2m?.[0] ?? 0;
  const isDay = om?.current?.is_day ??  om?.current_weather?.is_day ??  om.hourly.is_day?.[0] ??  1;
  changeTheme(currentTemp, isDay);
  const wind = om?.current_weather?.windspeed ?? om.hourly?.wind_speed_10m?.[0] ?? 0;
  const windDir = om?.current_weather?.winddirection ?? om.hourly?.wind_direction_10m?.[0] ?? 0;
  const rain = om.hourly?.precipitation?.[0] ?? 0;
  const humidity = om.hourly?.relative_humidity_2m?.[0] ?? 0;
  //const icon = iconForWeather(om?.current_weather?.weathercode ?? om.hourly?.weather_code?.[0], isDay);
  const iconUrl = iconForWeather(om?.current_weather?.weathercode ?? om.hourly?.weather_code?.[0], isDay);



  currentWeatherDiv.innerHTML = `
    <div class="current-weather-card" style="background: rgba(255,255,255, 1.5); border-radius: 12px; padding: 15px; text-align: center;">
    <img src="${iconUrl}" alt="Weather Icon" style="width: 80px; height: 80px;">
    <div style="font-size: 3rem; font-weight: bold;">${cToUnit(currentTemp, unit)}</div>
    <div>💨 ${wind} km/h</div>
    <div>💧 ${humidity}%</div>
    <div>🌧️ ${rain} mm</div>
    <span style="font-size: 0.9rem; color: gray;">(Open-Meteo)</span>
  </div>
  `;
 
  if (om.hourly?.time) {
    const hours = om.hourly.time.slice(0, 24);
    const temps = om.hourly.temperature_2m.slice(0, 24);
    const winds = om.hourly.wind_speed_10m.slice(0, 24);
    const rainArr = om.hourly.precipitation.slice(0, 24);
    const humidityArr = om.hourly.relative_humidity_2m.slice(0, 24);
    hourlyForecastDiv.innerHTML = "<h4>Next 24 hours</h4><div class='scroll'>";
    hours.forEach((h, i) => {
      hourlyForecastDiv.innerHTML += `
        <div>
    <span>${h.slice(11,16)}</span>
    <span class="temp"><img src="${iconUrl}" alt="Weather Icon" style="width: 20px; height: 20px;">${cToUnit(temps[i], unit)}</span>
    <span>💨 ${winds[i]} km/h</span>
    <span>💧 ${humidityArr[i]} %</span>
  </div>`;
    });
    hourlyForecastDiv.innerHTML += "</div>";
  }
  if (om.daily?.time) {
    const maxTemps = om.daily.temperature_2m_max;
    const minTemps = om.daily.temperature_2m_min;
    const dailyWind = om.daily.wind_speed_10m_max;
    const dailyRain = om.daily.precipitation_sum;
    const humidityArr = om.hourly.relative_humidity_2m.slice(0, 24);
    dailyForecastDiv.innerHTML = "<h4>7-day Forecast</h4>";
    om.daily.time.forEach((d, i) => {
      dailyForecastDiv.innerHTML += `
         <div>
        <span>${d}</span>
        <span class="temp"><img src="${iconUrl}" alt="Weather Icon" style="width: 20px; height: 20px;">${cToUnit(maxTemps[i], unit)} / 🌙${cToUnit(minTemps[i], unit)}</span>
        <span>💨 ${dailyWind[i]} km/h</span>
        <span>💧 ${humidityArr[i]} %</span>
      </div>`;
    });
  }


  // Charts
  const labels = [];
  const sevenTemps = [];
  const owTemps = [];

  //  each step is ~3h
  if (seven.dataseries) {
    const subset = seven.dataseries.slice(0, 8); // ~24h
    subset.forEach(d => {
      labels.push(`${d.timepoint}h`);
      sevenTemps.push(d.temp2m);
    });
  }

  if (ow?.list) {
    const subset = ow.list.slice(0, 8);
    subset.forEach(f => {
      owTemps.push(f.main.temp);
    });
  }

  comparisonChartCanvas.innerHTML = "";
  chart = new frappe.Chart("#comparisonChart", {
    title: "24-hour Temperature Comparison (7Timer! vs OpenWeatherMap)",
    data: {
      labels,
      datasets: [
        { name: "OpenWeatherMap (°C)", type: "line", values: owTemps },
        { name: "7Timer! (°C)", type: "line", values: sevenTemps }
      ]
    },
    type: "line",
    height: 300,
    colors: ["#ff9933", "#3399ff"],
    axisOptions: { xAxisMode: "tick" },
    lineOptions: { regionFill: 0 },
    tooltipOptions: { formatTooltipX: d => d, formatTooltipY: d => `${d} °C` }
  });
}

unitSelect.onchange = () => {
  if (coords) loadWeather();
};
