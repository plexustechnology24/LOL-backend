const mongoose = require("mongoose");

const mongoUri = process.env.MONGODB_URI; 
const mongoUri2 = process.env.MONGODB_URI2;

if (!mongoUri || !mongoUri2) {
  console.error("MongoDB URIs are not set. Please check your environment variables.");
  process.exit(1);
}

const options = {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  maxPoolSize: 50, 
  minPoolSize: 5, 
  tls: true,
  tlsAllowInvalidCertificates: true,
};


const connection1 = mongoose.createConnection(mongoUri, options);
const connection2 = mongoose.createConnection(mongoUri2, options);

// Connection Events
const handleConnection = (connection, name) => {
  connection.on('connected', () => console.log(`${name} Connected!`));
  connection.on('error', (error) => console.error(`${name} connection error:`, error.message));
  connection.on('disconnected', () => console.log(`${name} Disconnected.`));
};

handleConnection(connection1, 'Primary MongoDB');
handleConnection(connection2, 'Secondary MongoDB');

// Graceful Shutdown for Both Connections
const gracefulShutdown = async () => {
  try {
    await connection1.close();
    await connection2.close();
    console.log("All MongoDB connections closed gracefully.");
    process.exit(0);
  } catch (error) {
    console.error("Error during MongoDB shutdown:", error);
    process.exit(1);
  }
};

// Handle process termination
process.on('SIGINT', gracefulShutdown);
process.on('SIGTERM', gracefulShutdown);

module.exports = {
  connection1,
  connection2
};