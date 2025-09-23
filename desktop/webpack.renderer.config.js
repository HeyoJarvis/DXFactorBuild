const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');

module.exports = {
  target: 'electron-renderer',
  entry: './renderer/index.js',
  output: {
    path: path.resolve(__dirname, 'renderer/dist'),
    filename: 'renderer.bundle.js',
    clean: true
  },
  module: {
    rules: [
      {
        test: /\.(js|jsx)$/,
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader',
          options: {
            presets: ['@babel/preset-env', '@babel/preset-react']
          }
        }
      },
      {
        test: /\.css$/,
        use: ['style-loader', 'css-loader']
      },
      {
        test: /\.(png|jpg|jpeg|gif|svg|webp)$/,
        type: 'asset/resource'
      }
    ]
  },
  plugins: [
    new HtmlWebpackPlugin({
      template: './renderer/copilot.html',
      filename: 'index.html'
    })
  ],
  resolve: {
    extensions: ['.js', '.jsx', '.json']
  },
  devServer: {
    port: 3000,
    hot: true
  }
};
