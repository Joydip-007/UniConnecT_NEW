"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("./email.worker");
require("./notification.worker");
require("./badge.worker");
const logger_1 = require("../utils/logger");
logger_1.logger.info('UniConnecT workers started');
