"""
NetSage AI - Knowledge Base Retrieval Engine
Uses TF-IDF and Cosine Similarity to retrieve the top 3-5 relevant troubleshooting cases.
"""

from typing import List, Dict, Any
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
import numpy as np

class CaseRetrievalEngine:
    def __init__(self, cases: List[Dict[str, Any]]):
        self.cases = cases
        self._prepare_vectorizer()

    def _prepare_vectorizer(self):
        """Prepare TF-IDF corpus from all troubleshooting cases."""
        self.corpus = []
        for c in self.cases:
            # Combine case fields into a rich searchable text document
            doc = f"{c.get('case_id', '')} {c.get('title', '')} {c.get('symptom', '')} {c.get('concept', '')} {c.get('osi_layer', '')} {c.get('expected_fault', '')} {c.get('show_output', '')} {c.get('recommended_fix', '')}"
            self.corpus.append(doc)
            
        if self.corpus:
            self.vectorizer = TfidfVectorizer(stop_words='english', ngram_range=(1, 2))
            self.tfidf_matrix = self.vectorizer.fit_transform(self.corpus)
        else:
            self.vectorizer = None
            self.tfidf_matrix = None

    def retrieve_relevant_cases(self, problem_text: str, search_terms: List[str] = None, possible_concepts: List[str] = None, top_k: int = 5) -> List[Dict[str, Any]]:
        """Retrieve top_k cases matching problem query."""
        if not self.cases or self.tfidf_matrix is None:
            return []
            
        search_query = problem_text
        if search_terms:
            search_query += " " + " ".join(search_terms)
        if possible_concepts:
            search_query += " " + " ".join(possible_concepts)
            
        query_vec = self.vectorizer.transform([search_query])
        similarities = cosine_similarity(query_vec, self.tfidf_matrix).flatten()
        
        # Concept matching boost
        if possible_concepts:
            concepts_upper = [c.upper() for c in possible_concepts]
            for idx, case in enumerate(self.cases):
                case_concept = case.get('concept', '').upper()
                if case_concept in concepts_upper:
                    similarities[idx] += 0.25 # Boost score by 0.25 if concept matches
                    
        # Sort indices by score descending
        top_indices = np.argsort(similarities)[::-1][:top_k]
        
        results = []
        for idx in top_indices:
            case_data = dict(self.cases[idx])
            case_data['similarity_score'] = float(round(similarities[idx], 4))
            results.append(case_data)
            
        return results
