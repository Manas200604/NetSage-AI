"""
Unit tests for NetSage AI Knowledge Base Retrieval Engine
"""

import sys
import os
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'backend')))

from retrieval_engine import CaseRetrievalEngine

sample_cases = [
    {
        "case_id": "CASE-001",
        "title": "Inter-VLAN Communication Failure",
        "symptom": "PC1 in VLAN 10 cannot ping Server1 in VLAN 20",
        "concept": "VLAN",
        "osi_layer": "Layer 3",
        "expected_fault": "Subinterface for VLAN 20 is down",
        "show_output": "Gi0/0/0.20 unassigned DOWN DOWN",
        "recommended_fix": "Configure subinterface dot1Q 20"
    },
    {
        "case_id": "CASE-005",
        "title": "Host Default Gateway Misconfiguration",
        "symptom": "HostA default gateway 192.168.1.254 does not match router 192.168.1.1",
        "concept": "Gateway",
        "osi_layer": "Layer 3",
        "expected_fault": "Default gateway mismatch",
        "show_output": "GigabitEthernet0/0 192.168.1.1 UP UP",
        "recommended_fix": "Change HostA gateway setting to 192.168.1.1"
    },
    {
        "case_id": "CASE-016",
        "title": "Missing Static Route",
        "symptom": "Router R1 cannot reach subnet 172.16.2.0/24 behind R2",
        "concept": "Routing",
        "osi_layer": "Layer 3",
        "expected_fault": "Missing static route",
        "show_output": "show ip route missing 172.16.2.0",
        "recommended_fix": "ip route 172.16.2.0 255.255.255.0 10.0.0.2"
    }
]

def test_retrieval_vlan_case():
    engine = CaseRetrievalEngine(sample_cases)
    results = engine.retrieve_relevant_cases(
        problem_text="PC cannot ping server in VLAN 20 subinterface down",
        possible_concepts=["VLAN"],
        top_k=2
    )
    assert len(results) > 0
    assert results[0]["case_id"] == "CASE-001"

def test_retrieval_routing_case():
    engine = CaseRetrievalEngine(sample_cases)
    results = engine.retrieve_relevant_cases(
        problem_text="Missing static route to destination subnet 172.16.2.0",
        possible_concepts=["Routing"],
        top_k=1
    )
    assert len(results) > 0
    assert results[0]["case_id"] == "CASE-016"
