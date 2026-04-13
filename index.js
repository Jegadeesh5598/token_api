const express = require('express');
const cors = require('cors');
require('dotenv').config();

const supabase = require('./supabaseClient');

const app = express();
app.use(cors());
app.use(express.json());

// CREATE ENTRY API
app.post('/add-entry', async (req, res) => {
  const {
    s_no,
    serial_number,
    token_number,
    ration_card_number,
    no_of_people,
    phone_number
  } = req.body;

  try {
    // 🔴 Check Ration Card Exists
    const { data: rationData } = await supabase
      .from('ration_entries')
      .select('*')
      .eq('ration_card_number', ration_card_number);

    if (rationData.length > 0) {
      return res.status(400).json({
        message: `Ration Card already mapped with Token ${rationData[0].token_number}`
      });
    }

    // 🔴 Check Serial Number Exists
    const { data: serialData } = await supabase
      .from('ration_entries')
      .select('*')
      .eq('serial_number', serial_number);

    if (serialData.length > 0) {
      return res.status(400).json({
        message: `Serial Number already mapped with Token ${serialData[0].token_number}`
      });
    }

    // ✅ Insert Data
    const { data, error } = await supabase
      .from('ration_entries')
      .insert([
        {
          s_no,
          serial_number,
          token_number,
          ration_card_number,
          no_of_people,
          phone_number
        }
      ]);

    if (error) throw error;

    res.json({ message: 'Data inserted successfully', data });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(5000, () => console.log('Server running on port 5000'));