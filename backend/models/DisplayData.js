const mongoose = require('mongoose');

const displayDataSchema = new mongoose.Schema({
    segment1: {
        type: [Number],
        required: true,
        validate: {
            validator: function(v) {
                return v.length === 4 && v.every(num => num >= 0 && num <= 9);
            },
            message: 'Each segment must contain exactly 4 digits between 0 and 9'
        }
    },
    segment2: {
        type: [Number],
        required: true,
        validate: {
            validator: function(v) {
                return v.length === 4 && v.every(num => num >= 0 && num <= 9);
            },
            message: 'Each segment must contain exactly 4 digits between 0 and 9'
        }
    },
    segment3: {
        type: [Number],
        required: true,
        validate: {
            validator: function(v) {
                return v.length === 4 && v.every(num => num >= 0 && num <= 9);
            },
            message: 'Each segment must contain exactly 4 digits between 0 and 9'
        }
    }
});

module.exports = mongoose.model('DisplayData', displayDataSchema);