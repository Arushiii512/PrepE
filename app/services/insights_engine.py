import re
import json
import numpy as np
from typing import List, Dict, Any, Optional
from sklearn.cluster import KMeans
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.decomposition import PCA
import plotly.express as px
import plotly.graph_objects as go
import plotly.io as pio

from app.services.embedding_service import get_embedding_model
from app.schemas.insights import TopicCluster, ClusterAnalysisResponse, ClusterAnalysisRequest

def extract_questions_from_text(raw_text: str) -> List[str]:
    """
    Parse previous year questions from raw text or exam papers.
    Handles lines starting with numbers, 'Q1.', '1)', 'Question 1:', or plain bullet points.
    """
    lines = raw_text.splitlines()
    questions = []
    current_q = []
    
    # Regex matching start of a question: "1.", "1)", "Q1:", "Question 1", etc.
    q_start_pattern = re.compile(r'^\s*(?:Q(?:uestion)?\s*\.?\s*\d+[\.\:\)]|\d+[\.\)])\s*', re.IGNORECASE)
    
    for line in lines:
        stripped = line.strip()
        if not stripped:
            continue
        
        if q_start_pattern.match(stripped):
            if current_q:
                questions.append(" ".join(current_q))
                current_q = []
            cleaned = q_start_pattern.sub('', stripped)
            if cleaned:
                current_q.append(cleaned)
        else:
            if current_q:
                current_q.append(stripped)
            else:
                # If no numbering is used, treat non-empty line as individual question
                if len(stripped) > 15:
                    questions.append(stripped)
    
    if current_q:
        questions.append(" ".join(current_q))
    
    # Filter out very short noisy strings
    filtered = [q.strip() for q in questions if len(q.strip()) > 10]
    return filtered if filtered else [l.strip() for l in lines if len(l.strip()) > 10]

class InsightsEngine:
    def __init__(self):
        pass

    def analyze_pyqs(self, request: ClusterAnalysisRequest) -> ClusterAnalysisResponse:
        questions = request.questions
        n_samples = len(questions)
        if n_samples < 2:
            raise ValueError("At least 2 questions are required for clustering analysis.")
        
        # 1. Determine number of clusters k
        if request.num_clusters is not None:
            k = min(request.num_clusters, n_samples)
        else:
            k = min(5, max(2, n_samples // 3))
        
        # 2. Compute embeddings using all-MiniLM-L6-v2
        embed_model = get_embedding_model()
        embeddings = embed_model.encode(questions, convert_to_numpy=True, show_progress_bar=False)
        
        # 3. Fit KMeans Clustering
        kmeans = KMeans(n_clusters=k, random_state=42, n_init=10)
        labels = kmeans.fit_predict(embeddings)
        
        # 4. Extract Top Keywords per Cluster using TF-IDF
        cluster_groups: Dict[int, List[str]] = {i: [] for i in range(k)}
        for q, label in zip(questions, labels):
            cluster_groups[label].append(q)
            
        clusters_meta: List[TopicCluster] = []
        
        for cluster_id, q_list in cluster_groups.items():
            count = len(q_list)
            percentage = round((count / n_samples) * 100, 1) if n_samples > 0 else 0
            
            # Extract keywords via TF-IDF
            keywords = []
            if count > 0:
                try:
                    tfidf = TfidfVectorizer(stop_words='english', max_features=5)
                    tfidf.fit(q_list)
                    keywords = list(tfidf.get_feature_names_out())
                except ValueError:
                    # If all words are stop words or tokens empty
                    words = [w.lower() for q in q_list for w in re.findall(r'\b[a-zA-Z]{3,}\b', q)]
                    keywords = list(dict.fromkeys(words))[:4]
            
            # Format topic label
            if keywords:
                topic_label = " / ".join(w.capitalize() for w in keywords[:3])
            else:
                topic_label = f"Topic Group {cluster_id + 1}"
                
            clusters_meta.append(TopicCluster(
                cluster_id=cluster_id,
                topic_label=topic_label,
                keywords=keywords,
                question_count=count,
                percentage=percentage,
                sample_questions=q_list[:3]
            ))
            
        # Sort clusters by frequency (highest percentage first)
        clusters_meta.sort(key=lambda x: x.question_count, reverse=True)
        
        # 5. Build Interactive Plotly Charts
        
        # Chart 1: Topic Frequency Bar Chart
        labels_bar = [c.topic_label for c in clusters_meta]
        counts_bar = [c.question_count for c in clusters_meta]
        pcts_bar = [f"{c.percentage}%" for c in clusters_meta]
        
        fig_bar = go.Figure(data=[
            go.Bar(
                x=counts_bar,
                y=labels_bar,
                orientation='h',
                text=pcts_bar,
                textposition='auto',
                marker=dict(
                    color='rgba(58, 123, 213, 0.85)',
                    line=dict(color='rgba(58, 123, 213, 1.0)', width=1.5)
                )
            )
        ])
        fig_bar.update_layout(
            title="Frequently Tested Exam Topics (By Question Frequency)",
            xaxis_title="Number of Questions",
            yaxis_title="Topic Cluster",
            yaxis=dict(autorange="reversed"),
            margin=dict(l=20, r=20, t=40, b=20),
            template="plotly_white"
        )
        bar_chart_json = pio.to_json(fig_bar, pretty=False)
        
        # Chart 2: 2D PCA Semantic Projection Scatter Plot
        scatter_chart_json = None
        if n_samples >= 2:
            pca = PCA(n_components=2, random_state=42)
            coords = pca.fit_transform(embeddings)
            
            cluster_id_to_label = {c.cluster_id: c.topic_label for c in clusters_meta}
            assigned_labels = [cluster_id_to_label.get(lbl, f"Cluster {lbl}") for lbl in labels]
            
            # Short hover previews
            hover_previews = [q[:100] + "..." if len(q) > 100 else q for q in questions]
            
            fig_scatter = px.scatter(
                x=coords[:, 0],
                y=coords[:, 1],
                color=assigned_labels,
                hover_name=hover_previews,
                labels={"x": "Semantic Dimension 1", "y": "Semantic Dimension 2", "color": "Topic"},
                title="Semantic Map of Previous-Year Questions (KMeans Clusters)"
            )
            fig_scatter.update_layout(
                template="plotly_white",
                margin=dict(l=20, r=20, t=40, b=20)
            )
            scatter_chart_json = pio.to_json(fig_scatter, pretty=False)

        return ClusterAnalysisResponse(
            total_questions_analyzed=n_samples,
            clusters=clusters_meta,
            plotly_chart_json=json.loads(bar_chart_json),
            scatter_chart_json=json.loads(scatter_chart_json) if scatter_chart_json else None
        )

insights_service = InsightsEngine()
