const downloadImage = async (message) => {
  const { entry, format } = JSON.parse(message);
  const a = document.createElement("a");
  const { domToPng } = await import("modern-screenshot");

  const data = await domToPng(document.body, {
    backgroundColor: "white",
    scale: 2,
  });

  a.download = `${entry}.${format}`;
  a.href = data;
  a.click();
  a.remove();
};

export default downloadImage;
