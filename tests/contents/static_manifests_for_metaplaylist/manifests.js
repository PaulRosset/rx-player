import manifest1 from "raw-loader!./dash_content_envivio.mpd";
import manifest2 from "raw-loader!./dash_content_tos.mpd";
import manifest3 from "raw-loader!./smooth_content.ism";

const manifestBlob1 = new Blob([manifest1], { type: "application/xml" });
const manifestURL1 = URL.createObjectURL(manifestBlob1);

const manifestBlob2 = new Blob([manifest2], { type: "application/xml" });
const manifestURL2 = URL.createObjectURL(manifestBlob2);

const manifestBlob3 = new Blob([manifest3], { type: "application/xml" });
const manifestURL3 = URL.createObjectURL(manifestBlob3);

export {
  manifestURL1,
  manifestURL2,
  manifestURL3,
};
