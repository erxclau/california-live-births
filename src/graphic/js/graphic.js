// JS for your graphic
import pym from "pym.js";
import * as d3 from "d3";
import { build, LineChart } from "@michigandaily/bore";
import data from "../data/data.csv?autoType=false";
import template from "../data/template.csv?autoType=false";
import weights from "../data/weights.csv?autoType=false";

import downloadImage from "./util/download-image";
import setDisplayOptions from "./util/set-display";

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const draw = async () => {
  const zipcodes = new Set(
    template
      .filter((d) => d.localityType === "ZIPCODE")
      .map((d) => d.localityName)
  );

  const neighborhoods = template.filter(
    (d) => d.localityType === "NEIGHBORHOOD"
  );

  const zdata = data
    .map((d) => ({ year: +d.Year, zipcode: d.ZIP_Code, count: +d.Count }))
    .filter((d) => zipcodes.has(d.zipcode));

  const zmap = d3.rollup(
    zdata,
    (v) => new Map(v.map((d) => [new Date(d.year, 0, 0), d.count])),
    (d) => d.zipcode
  );

  const zindex = d3.group(zdata, (d) => d.zipcode);
  const nindex = d3.group(weights, (d) => d.leftId);

  const ndata = neighborhoods
    .map((d) => {
      const z = nindex.get(d.localityId);

      const nmap = new Map();
      z.forEach((zip) => {
        const w = +zip.fractionOfRightInLeft.replace("%", "") / 100;
        if (zindex.has(zip.rightName)) {
          const weighted = zindex
            .get(zip.rightName)
            .map((d) => ({ ...d, count: Math.round(d.count * w) }));

          weighted.forEach((d) => {
            if (nmap.has(d.year)) {
              nmap.set(d.year, nmap.get(d.year) + d.count);
            } else {
              nmap.set(d.year, d.count);
            }
          });
        }
      });

      return Array.from(nmap).map((m) => ({
        year: m[0],
        count: m[1],
        id: d.localityId,
      }));
    })
    .flat();

  const nmap = d3.rollup(
    ndata,
    (v) => new Map(v.map((d) => [new Date(d.year, 0, 0), d.count])),
    (d) => d.id
  );

  const figure = d3.select("figure");
  const width = figure.node().clientWidth;

  const svg = figure.append("svg");

  const map = new Map([...zmap, ...nmap]);

  const update = (id, name = null, redraw = false) => {
    svg
      .datum(map.get(id))
      .call(
        build(new LineChart().height(400).margin({ left: 50 }).redraw(redraw))
      );

    d3.select(".figure__title").text(
      `Number of live births in ${name ?? id} since 1982`
    );
  };

  const nnames = d3.index(neighborhoods, (d) => d.localityId);

  let redraw = false;
  for await (const neighborhood of nindex.keys()) {
    update(neighborhood, nnames.get(neighborhood).localityName, redraw);
    await sleep(1500);
    await downloadImage(
      JSON.stringify({
        entry: neighborhood,
        format: "png",
        width,
      })
    );
    redraw = true;
  }

  for await (const zipcode of zipcodes) {
    update(zipcode, null, redraw);
    await sleep(1500);
    await downloadImage(
      JSON.stringify({
        entry: zipcode,
        format: "png",
        width,
      })
    );
    redraw = true;
  }
};

window.onresize = () => {};

window.onload = () => {
  const child = new pym.Child({ polling: 500 });
  child.sendHeight();
  child.onMessage("download", downloadImage);
  setDisplayOptions();
  draw();
};
