const path = require("path");
const nodeExternals = require("webpack-node-externals");
const CopyPlugin = require("copy-webpack-plugin");

module.exports = {
  target: "node",
  mode: "production",
  entry: "./main.js",
  output: {
    path: path.resolve(__dirname, "dist"),
    filename: "bundle.js",
  },
  externals: [nodeExternals()],
  module: {
    rules: [
      {
        test: /\.js$/,
        exclude: /node_modules/,
        use: {
          loader: "babel-loader",
          options: {
            presets: ["@babel/preset-env"],
          },
        },
      },
    ],
  },
  plugins: [
    new CopyPlugin({
      patterns: [
        { from: "config", to: "config" },
        { from: "uploads", to: "uploads", noErrorOnMissing: true },
        { from: ".env", noErrorOnMissing: true },
        { from: "package.json" },
      ],
    }),
  ],
  optimization: {
    minimize: true,
  },
  resolve: {
    extensions: [".js"],
  },
};
