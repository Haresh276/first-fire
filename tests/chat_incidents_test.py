"""Incident routing through the service entry point, before experiment retrieval."""
import unittest
from unittest.mock import Mock

from chat.engine import Engine


def question(text):
    return {"role": "user", "content": text}


class IncidentTests(unittest.TestCase):
    example = "tell me about the apollo fire accident"

    def setUp(self):
        self.engine = Engine.__new__(Engine)
        self.engine.provider = Mock()
        self.engine.index = Mock()

    def historical(self, text, *history):
        result = self.engine.answer({"message": text, "history": list(history)})
        self.engine.index.retrieve.assert_not_called()
        self.engine.provider.select.assert_not_called()
        self.assertEqual(result["retrieved"], [])
        return result

    def test_reported_question(self):
        reply = self.historical(self.example, question("Who is Virat Kohli?"))
        self.assertEqual(reply["status"], "answered")
        for phrase in ("Apollo 1", "January 27, 1967", "Complex 34", "Grissom", "Ed White", "Chaffee", "electrical arc"):
            self.assertIn(phrase, reply["answer"])
        self.assertEqual([s["id"] for s in reply["citations"]], ["apollo1:mission", "apollo1:board"])
        self.assertTrue(all(s["url"].startswith("https://www.nasa.gov/") for s in reply["citations"]))

    def test_contiguous_followups_and_new_mission(self):
        history = [question(self.example), question("who was on board?")]
        for prompt, expected in (("how did it start?", "could not establish"),
                                 ("Do we know exactly what ignited it?", "could not establish"),
                                 ("What was the probable ignition source?", "electrical arc"),
                                 ("What did investigators determine?", "could not establish"),
                                 ("how did they escape?", "too late"),
                                 ("what did NASA change?", "opened outward"),
                                 ("what was the pressure?", "16.7 psia")):
            with self.subTest(prompt):
                self.assertIn(expected, self.historical(prompt, *history)["answer"])
        compared = self.historical("Was that Apollo 13?", *history)
        self.assertEqual([s["id"] for s in compared["citations"]], ["apollo1:mission", "apollo13:mission"])
        reply = self.historical("What about Apollo 13?", *history)
        self.assertIn("April 13, 1970", reply["answer"])
        self.assertIn("April 17", reply["answer"])
        reply = self.historical("who was on board?", *history, question("What about Apollo 13?"))
        self.assertIn("Swigert", reply["answer"])
        self.assertNotIn("Grissom", reply["answer"])

    def test_abstains_on_other_incidents_and_missing_details(self):
        for prompt in ("tell me about the Mir fire accident", "How hot was Apollo 1's cabin at ignition?",
                       "what about the Apollo 11 fire?", "what happened in the Zarya fire incident?",
                       "Which accident happened on Apollo?", "Compare Apollo 1 to the Saffire-II experiment",
                       "Which technician certified the Apollo 1 test?"):
            with self.subTest(prompt):
                reply = self.historical(prompt, question(self.example))
                self.assertEqual((reply["status"], reply["citations"]), ("abstained", []))

    def test_research_and_unrelated_turns_end_incident_context(self):
        from chat.incidents import scoped_reply
        first = question(self.example)
        self.assertIsNone(scoped_reply("Tell me about FLEX-155", [first]))
        self.assertIsNone(scoped_reply("Who was on board?", [first, question("Tell me about FLEX-155")]))
        self.assertIsNone(scoped_reply("tell me about Virat Kohli", [first]))
        self.assertIsNone(scoped_reply("Who was on board?", [first, question("What about the Gemini accident?")]))
        self.assertEqual(scoped_reply("What was its precise cabin temperature?", [first])[0], "abstained")
        self.assertIsNone(scoped_reply("who died?", [{"role": "assistant", "content": self.example}]))

    def test_capability_checks_still_apply(self):
        result = self.historical("Read my attached photo of the Apollo 1 fire. What caused it?")
        self.assertIn("attachment", result["answer"])
        self.assertEqual(result["citations"], [])


if __name__ == "__main__":
    unittest.main()
