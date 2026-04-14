const express = require('express');
const cors = require('cors');
require('dotenv').config();

const supabase = require('./supabaseClient');

const app = express();
app.use(cors());
app.use(express.json());

/**
 * 🔧 Helper: Convert "2,4,5" → ["2","4","5"]
 */
const parseSerials = (serial) => {
  return serial
    ? serial.split(',').map(s => s.trim()).filter(Boolean)
    : [];
};


/**
 * ============================
 * 🟢 CREATE ENTRY API
 * ============================
 */
app.post('/add-entry', async (req, res) => {
  console.log("📥 Incoming:", req.body);

  const {
    s_no,
    serial_number,
    token_number,
    ration_card_number,
    no_of_voters,
    no_of_non_voters,
    no_of_total_peoples,
    phone_number,
    admin
  } = req.body;

  try {
    const inputSerials = parseSerials(serial_number);

    // 🔴 1. TOKEN NUMBER UNIQUE
    const { data: tokenData } = await supabase
      .from('ration_entries')
      .select('*')
      .eq('token_number', token_number);

    if (tokenData.length > 0) {
      console.log("❌ Token already used");

      return res.status(400).json({
        message: "This token is already distributed"
      });
    }

    // 🔴 2. RATION CARD UNIQUE
    const { data: rationData } = await supabase
      .from('ration_entries')
      .select('*')
      .eq('ration_card_number', ration_card_number);

    if (rationData.length > 0) {
      console.log("❌ Ration duplicate");

      return res.status(400).json({
        message: `This ration card is mapped with serial ${rationData[0].serial_number} and token ${rationData[0].token_number}`
      });
    }

    // 🔴 3. SERIAL COUNT VALIDATION
    if (inputSerials.length !== Number(no_of_voters)) {
      return res.status(400).json({
        message: `Serial count (${inputSerials.length}) must match no_of_voters (${no_of_voters})`
      });
    }

    if (Number(no_of_total_peoples) !== Number(no_of_voters) + Number(no_of_non_voters)) {
      return res.status(400).json({
        message: "Total peoples must be voters + non_voters"
      });
    }

    // 🔴 4. SERIAL DUPLICATION CHECK
    const { data: allData } = await supabase
      .from('ration_entries')
      .select('*');

    for (let row of allData) {
      const dbSerials = parseSerials(row.serial_number);

      for (let serial of inputSerials) {
        if (dbSerials.includes(serial)) {
          console.log("❌ Serial duplicate:", serial);

          return res.status(400).json({
            message: `This SerialNumber ${serial} is already mapped with ration ${row.ration_card_number} and token ${row.token_number}`
          });
        }
      }
    }

    // ✅ INSERT
    console.log("✅ Inserting...");

    const { data, error } = await supabase
      .from('ration_entries')
      .insert([{
        s_no,
        serial_number,
        token_number,
        ration_card_number,
        no_of_voters,
        no_of_non_voters,
        no_of_total_peoples,
        phone_number,
        admin
      }]);

    if (error) throw error;

    res.json({
      message: "Data inserted successfully",
      data
    });

  } catch (err) {
    console.log("🔥 ERROR:", err.message);
    res.status(500).json({ error: err.message });
  }
});


/**
 * ============================
 * 📥 GET ALL
 * ============================
 */
app.get('/entries', async (req, res) => {
  console.log("📤 Fetch all");

  try {
    const { data, error } = await supabase
      .from('ration_entries')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    res.json(data);
    console.log(data,"+++++++")

  } catch (err) {
    console.log("🔥 ERROR:", err.message);
    res.status(500).json({ error: err.message });
  }
});


/**
 * ============================
 * ✏️ UPDATE API
 * ============================
 */
app.put('/update-entry/:id', async (req, res) => {
  const { id } = req.params;

  console.log("✏️ Update ID:", id);

  const {
    s_no,
    serial_number,
    token_number,
    ration_card_number,
    no_of_voters,
    no_of_non_voters,
    no_of_total_peoples,
    phone_number,
    admin
  } = req.body;

  try {
    const inputSerials = parseSerials(serial_number);

    // 🔴 TOKEN CHECK (exclude current)
    const { data: tokenData } = await supabase
      .from('ration_entries')
      .select('*')
      .eq('token_number', token_number)
      .neq('id', id);

    if (tokenData.length > 0) {
      return res.status(400).json({
        message: "This token is already distributed"
      });
    }

    // 🔴 RATION CHECK
    const { data: rationData } = await supabase
      .from('ration_entries')
      .select('*')
      .eq('ration_card_number', ration_card_number)
      .neq('id', id);

    if (rationData.length > 0) {
      return res.status(400).json({
        message: "Ration card already exists"
      });
    }

    // 🔴 SERIAL COUNT
    if (inputSerials.length !== Number(no_of_voters)) {
      return res.status(400).json({
        message: "Serial count mismatch"
      });
    }

    if (Number(no_of_total_peoples) !== Number(no_of_voters) + Number(no_of_non_voters)) {
      return res.status(400).json({
        message: "Total peoples mismatch"
      });
    }

    // 🔴 SERIAL DUPLICATE
    const { data: allData } = await supabase
      .from('ration_entries')
      .select('*');

    for (let row of allData) {
      if (row.id === id) continue;

      const dbSerials = parseSerials(row.serial_number);

      for (let serial of inputSerials) {
        if (dbSerials.includes(serial)) {
          return res.status(400).json({
            message: `Serial ${serial} already mapped with ration ${row.ration_card_number}`
          });
        }
      }
    }

    // ✅ UPDATE
    const { data, error } = await supabase
      .from('ration_entries')
      .update({
        s_no,
        serial_number,
        token_number,
        ration_card_number,
        no_of_voters,
        no_of_non_voters,
        no_of_total_peoples,
        phone_number,
        admin,
        updated_at: new Date().toISOString()
      })
      .eq('id', id);

    if (error) throw error;

    res.json({ message: "Updated successfully", data });

  } catch (err) {
    console.log("🔥 ERROR:", err.message);
    res.status(500).json({ error: err.message });
  }
});


/**
 * ============================
 * 🗑️ DELETE API
 * ============================
 */
app.delete('/delete-entry/:id', async (req, res) => {
  const { id } = req.params;

  console.log("🗑️ Delete:", id);

  try {
    const { error } = await supabase
      .from('ration_entries')
      .delete()
      .eq('id', id);

    if (error) throw error;

    res.json({ message: "Deleted successfully" });

  } catch (err) {
    console.log("🔥 ERROR:", err.message);
    res.status(500).json({ error: err.message });
  }
});


/**
 * ============================
 * 🚀 SERVER
 * ============================
 */
app.listen(5000, () => {
  console.log("Server running on port 5000");
});